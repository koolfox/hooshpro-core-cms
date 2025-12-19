from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import MediaAsset, MediaFolder, User
from app.schemas.media import (
    MediaFolderCreate,
    MediaFolderListOut,
    MediaFolderOut,
    MediaFolderUpdate,
    MediaListOut,
    MediaMove,
    MediaOut,
)

router = APIRouter(tags=["media"])

def _would_create_folder_cycle(
    db: OrmSession, folder_id: int, parent_id: int
) -> bool:
    cur = parent_id
    for _ in range(2000):
        if cur == folder_id:
            return True
        nxt = (
            db.query(MediaFolder.parent_id)
            .filter(MediaFolder.id == cur)
            .scalar()
        )
        if nxt is None:
            return False
        cur = int(nxt)
    return True


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


@router.get("/api/admin/media/folders", response_model=MediaFolderListOut)
def admin_list_media_folders(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = (
        db.query(MediaFolder)
        .order_by(MediaFolder.parent_id.asc(), MediaFolder.name.asc())
        .all()
    )
    return MediaFolderListOut(items=[_to_folder_out(x) for x in items])


@router.post("/api/admin/media/folders", response_model=MediaFolderOut)
def admin_create_media_folder(
    payload: MediaFolderCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required.")

    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(MediaFolder).filter(MediaFolder.id == parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found.")

    f = MediaFolder(name=name[:200], parent_id=parent_id)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _to_folder_out(f)


@router.put("/api/admin/media/folders/{folder_id}", response_model=MediaFolderOut)
def admin_update_media_folder(
    folder_id: int,
    payload: MediaFolderUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    f = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Folder not found.")

    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Folder name is required.")
        f.name = name[:200]

    if payload.parent_id is not None:
        if payload.parent_id == 0:
            f.parent_id = None
        else:
            if payload.parent_id == folder_id:
                raise HTTPException(status_code=400, detail="Folder cannot be its own parent.")
            parent = db.query(MediaFolder).filter(MediaFolder.id == payload.parent_id).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent folder not found.")
            if _would_create_folder_cycle(db, folder_id, payload.parent_id):
                raise HTTPException(
                    status_code=400,
                    detail="Folder cannot be moved into itself or a descendant folder.",
                )
            f.parent_id = payload.parent_id

    db.commit()
    db.refresh(f)
    return _to_folder_out(f)


@router.delete("/api/admin/media/folders/{folder_id}")
def admin_delete_media_folder(
    folder_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    f = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Folder not found.")

    has_children = (
        db.query(MediaFolder).filter(MediaFolder.parent_id == folder_id).limit(1).first()
        is not None
    )
    if has_children:
        raise HTTPException(status_code=409, detail="Folder is not empty (has subfolders).")

    has_assets = (
        db.query(MediaAsset).filter(MediaAsset.folder_id == folder_id).limit(1).first()
        is not None
    )
    if has_assets:
        raise HTTPException(status_code=409, detail="Folder is not empty (has media).")

    db.delete(f)
    db.commit()
    return {"ok": True}


@router.get("/api/admin/media", response_model=MediaListOut)
def admin_list_media(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 40,
    offset: int = 0,
    q: str | None = None,
    folder_id: int | None = None,
):
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

    items = (
        base.order_by(MediaAsset.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return MediaListOut(
        items=[_to_out(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/api/admin/media/upload", response_model=MediaOut)
async def admin_upload_media(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    folder_id: int | None = Form(default=None),
):
    ct = (file.content_type or "").lower().strip()

    if not ct.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are supported (image/*).")

    resolved_folder_id: int | None = None
    if folder_id is not None and folder_id != 0:
        folder = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found.")
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
                    raise HTTPException(status_code=413, detail="File too large.")
                f.write(chunk)
    except HTTPException:
        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass
        raise
    except Exception:
        if target.exists():
            try:
                target.unlink()
            except Exception:
                pass
        raise
    finally:
        await file.close()

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
            try:
                target.unlink()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Could not save media.")

    db.refresh(m)
    return _to_out(m)


@router.delete("/api/admin/media/{media_id}")
def admin_delete_media(
    media_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")

    target = _media_dir() / m.stored_name

    db.delete(m)
    db.commit()

    if target.exists():
        try:
            target.unlink()
        except Exception:
            pass

    return {"ok": True}


@router.put("/api/admin/media/{media_id}", response_model=MediaOut)
def admin_move_media(
    media_id: int,
    payload: MediaMove,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")

    folder_id = int(payload.folder_id or 0)
    if folder_id < 0:
        raise HTTPException(status_code=400, detail="folder_id must be >= 0")

    if folder_id == 0:
        m.folder_id = None
    else:
        folder = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found.")
        m.folder_id = folder_id

    db.commit()
    db.refresh(m)
    return _to_out(m)
