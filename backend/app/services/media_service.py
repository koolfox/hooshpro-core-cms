from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.config import settings
from app.models import MediaAsset, MediaFolder
from app.schemas.media import (
    MediaFolderCreate,
    MediaFolderListOut,
    MediaFolderOut,
    MediaFolderUpdate,
    MediaListOut,
    MediaMove,
    MediaOut,
)


# --- Errors ------------------------------------------------------------------

class MediaBadRequest(Exception):
    pass


class MediaConflict(Exception):
    pass


class MediaNotFound(Exception):
    pass


class MediaUnsupported(Exception):
    pass


class MediaTooLarge(Exception):
    pass


# --- Helpers -----------------------------------------------------------------

def _media_dir() -> Path:
    d = Path(settings.MEDIA_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _guess_ext(filename: str, content_type: str) -> str:
    name = (filename or "").lower().strip()
    if "." in name:
        ext = "." + name.rsplit(".", 1)[1]
        if 1 <= len(ext) <= 10:
            return ext

    ct = (content_type or "").lower()
    if ct == "image/jpeg":
        return ".jpg"
    if ct == "image/png":
        return ".png"
    if ct == "image/webp":
        return ".webp"
    if ct == "image/gif":
        return ".gif"
    if ct == "image/svg+xml":
        return ".svg"
    return ""


def _would_create_folder_cycle(db: OrmSession, folder_id: int, parent_id: int) -> bool:
    cur = parent_id
    for _ in range(2000):
        if cur == folder_id:
            return True
        nxt = db.query(MediaFolder.parent_id).filter(MediaFolder.id == cur).scalar()
        if nxt is None:
            return False
        cur = int(nxt)
    return True


def _to_out(m: MediaAsset) -> MediaOut:
    return MediaOut(
        id=m.id,
        url=f"{settings.MEDIA_URL_PREFIX}/{m.stored_name}",
        folder_id=m.folder_id,
        original_name=m.original_name,
        content_type=m.content_type,
        size_bytes=m.size_bytes,
        created_at=m.created_at,
    )


def _to_folder_out(f: MediaFolder) -> MediaFolderOut:
    return MediaFolderOut(
        id=f.id,
        name=f.name,
        parent_id=f.parent_id,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


# --- Public API --------------------------------------------------------------

def public_get_media(db: OrmSession, media_id: int) -> MediaOut | None:
    m = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    return _to_out(m) if m else None


def list_folders(db: OrmSession) -> MediaFolderListOut:
    items = (
        db.query(MediaFolder)
        .order_by(MediaFolder.parent_id.asc(), MediaFolder.name.asc())
        .all()
    )
    return MediaFolderListOut(items=[_to_folder_out(x) for x in items])


def create_folder(db: OrmSession, payload: MediaFolderCreate) -> MediaFolderOut:
    name = (payload.name or "").strip()
    if not name:
        raise MediaBadRequest("Folder name is required.")

    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(MediaFolder).filter(MediaFolder.id == parent_id).first()
        if not parent:
            raise MediaNotFound("Parent folder not found.")

    f = MediaFolder(name=name[:200], parent_id=parent_id)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _to_folder_out(f)


def update_folder(db: OrmSession, folder_id: int, payload: MediaFolderUpdate) -> MediaFolderOut:
    f = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
    if not f:
        raise MediaNotFound("Folder not found.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise MediaBadRequest("Folder name is required.")
        f.name = name[:200]

    if payload.parent_id is not None:
        if payload.parent_id == 0:
            f.parent_id = None
        else:
            if payload.parent_id == folder_id:
                raise MediaBadRequest("Folder cannot be its own parent.")
            parent = db.query(MediaFolder).filter(MediaFolder.id == payload.parent_id).first()
            if not parent:
                raise MediaNotFound("Parent folder not found.")
            if _would_create_folder_cycle(db, folder_id, payload.parent_id):
                raise MediaBadRequest("Folder cannot be moved into itself or a descendant folder.")
            f.parent_id = payload.parent_id

    db.commit()
    db.refresh(f)
    return _to_folder_out(f)


def delete_folder(db: OrmSession, folder_id: int) -> None:
    f = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
    if not f:
        raise MediaNotFound("Folder not found.")

    has_children = db.query(MediaFolder).filter(MediaFolder.parent_id == folder_id).limit(1).first() is not None
    if has_children:
        raise MediaConflict("Folder is not empty (has subfolders).")

    has_assets = db.query(MediaAsset).filter(MediaAsset.folder_id == folder_id).limit(1).first() is not None
    if has_assets:
        raise MediaConflict("Folder is not empty (has media).")

    db.delete(f)
    db.commit()


def list_media(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    folder_id: int | None,
    sort: str | None,
    direction: str | None,
) -> MediaListOut:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    base = db.query(MediaAsset)

    if folder_id is not None:
        if folder_id == 0:
            base = base.filter(MediaAsset.folder_id.is_(None))
        else:
            base = base.filter(MediaAsset.folder_id == folder_id)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(MediaAsset.original_name).like(qq))

    total = base.with_entities(func.count(MediaAsset.id)).scalar() or 0

    allowed_sorts = {
        "created_at": MediaAsset.created_at,
        "name": func.lower(MediaAsset.original_name),
        "original_name": func.lower(MediaAsset.original_name),
        "content_type": func.lower(MediaAsset.content_type),
        "size_bytes": MediaAsset.size_bytes,
        "id": MediaAsset.id,
    }

    sort_key = (sort or "created_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["created_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = MediaAsset.id.asc() if ascending else MediaAsset.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()

    return MediaListOut(
        items=[_to_out(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


async def upload_media(
    db: OrmSession,
    file: UploadFile,
    folder_id: int | None,
) -> MediaOut:
    ct = (file.content_type or "").lower().strip()
    if not ct.startswith("image/"):
        raise MediaUnsupported("Only image uploads are supported (image/*).")

    resolved_folder_id: int | None = None
    if folder_id is not None and folder_id != 0:
        folder = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
        if not folder:
            raise MediaNotFound("Folder not found.")
        resolved_folder_id = folder_id

    ext = _guess_ext(file.filename or "", ct)
    stored_name = f"{uuid4().hex}{ext}"
    target = _media_dir() / stored_name

    written = 0
    try:
        with target.open("wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > settings.MAX_UPLOAD_BYTES:
                    raise MediaTooLarge("File too large.")
                f.write(chunk)
    finally:
        await file.close()

    if written == 0:
        if target.exists():
            target.unlink(missing_ok=True)
        raise MediaBadRequest("Empty upload.")

    m = MediaAsset(
        folder_id=resolved_folder_id,
        original_name=(file.filename or "upload").strip()[:400],
        stored_name=stored_name,
        content_type=ct,
        size_bytes=written,
    )

    db.add(m)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if target.exists():
            target.unlink(missing_ok=True)
        raise

    db.refresh(m)
    return _to_out(m)


def delete_media(db: OrmSession, media_id: int) -> None:
    m = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not m:
        raise MediaNotFound("Not found")

    target = _media_dir() / m.stored_name
    db.delete(m)
    db.commit()
    if target.exists():
        target.unlink(missing_ok=True)


def move_media(db: OrmSession, media_id: int, payload: MediaMove) -> MediaOut:
    m = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not m:
        raise MediaNotFound("Not found")

    folder_id = int(payload.folder_id or 0)
    if folder_id < 0:
        raise MediaBadRequest("folder_id must be >= 0")

    if folder_id == 0:
        m.folder_id = None
    else:
        folder = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
        if not folder:
            raise MediaNotFound("Folder not found.")
        m.folder_id = folder_id

    db.commit()
    db.refresh(m)
    return _to_out(m)
