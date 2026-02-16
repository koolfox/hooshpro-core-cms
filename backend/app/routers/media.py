from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.media import (
    MediaFolderCreate,
    MediaFolderListOut,
    MediaFolderOut,
    MediaFolderUpdate,
    MediaListOut,
    MediaMove,
    MediaOut,
)
from app.services import media_service

router = APIRouter(tags=["media"])


@router.get("/api/public/media/{media_id}", response_model=MediaOut)
def public_get_media(
    media_id: int,
    db: OrmSession = Depends(get_db),
):
    m = media_service.public_get_media(db, media_id)
    if not m:
        raise HTTPException(status_code=404, detail="Media not found.")
    return m


@router.get("/api/admin/media/folders", response_model=MediaFolderListOut)
def admin_list_media_folders(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return media_service.list_folders(db)


@router.post("/api/admin/media/folders", response_model=MediaFolderOut)
def admin_create_media_folder(
    payload: MediaFolderCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return media_service.create_folder(db, payload)
    except media_service.MediaBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/api/admin/media/folders/{folder_id}", response_model=MediaFolderOut)
def admin_update_media_folder(
    folder_id: int,
    payload: MediaFolderUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return media_service.update_folder(db, folder_id, payload)
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except media_service.MediaBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/media/folders/{folder_id}")
def admin_delete_media_folder(
    folder_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        media_service.delete_folder(db, folder_id)
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except media_service.MediaConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/media", response_model=MediaListOut)
def admin_list_media(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 40,
    offset: int = 0,
    q: str | None = None,
    folder_id: int | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return media_service.list_media(db, limit, offset, q, folder_id, sort, dir)


@router.post("/api/admin/media/upload", response_model=MediaOut)
async def admin_upload_media(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
    folder_id: int | None = Form(default=None),
):
    try:
        return await media_service.upload_media(db, file, folder_id)
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except media_service.MediaUnsupported as exc:
        raise HTTPException(status_code=415, detail=str(exc))
    except media_service.MediaBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except media_service.MediaTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not save media.")


@router.delete("/api/admin/media/{media_id}")
def admin_delete_media(
    media_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        media_service.delete_media(db, media_id)
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.put("/api/admin/media/{media_id}", response_model=MediaOut)
def admin_move_media(
    media_id: int,
    payload: MediaMove,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return media_service.move_media(db, media_id, payload)
    except media_service.MediaNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except media_service.MediaBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))

