from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import MediaAsset, User
from app.schemas.media import MediaListOut, MediaOut

router = APIRouter(tags=["media"])


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
        original_name=m.original_name,
        content_type=m.content_type,
        size_bytes=m.size_bytes,
        created_at=m.created_at,
    )


@router.get("/api/admin/media", response_model=MediaListOut)
def admin_list_media(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 40,
    offset: int = 0,
    q: str | None = None,
):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    base = db.query(MediaAsset)

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
):
    ct = (file.content_type or "").lower().strip()

    if not ct.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image uploads are supported (image/*).")

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
    finally:
        await file.close()

    m = MediaAsset(
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
