from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.theme import PublicThemeOut, ThemeCreate, ThemeListOut, ThemeOut, ThemeUpdate
from app.services import themes_service

router = APIRouter(tags=["themes"])


@router.get("/api/admin/themes", response_model=ThemeListOut)
def admin_list_themes(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return themes_service.list_themes(db, limit, offset, q, sort, dir)


@router.post("/api/admin/themes", response_model=ThemeOut)
def admin_create_theme(
    payload: ThemeCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return themes_service.create_theme(db, payload)
    except themes_service.ThemeConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except themes_service.ThemeBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/admin/themes/{theme_id}", response_model=ThemeOut)
def admin_get_theme(
    theme_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = themes_service.get_theme(db, theme_id)
    if not row:
        raise HTTPException(status_code=404, detail="Theme not found")
    return row


@router.put("/api/admin/themes/{theme_id}", response_model=ThemeOut)
def admin_update_theme(
    theme_id: int,
    payload: ThemeUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return themes_service.update_theme(db, theme_id, payload)
    except themes_service.ThemeNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except themes_service.ThemeConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except themes_service.ThemeBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/themes/{theme_id}")
def admin_delete_theme(
    theme_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        themes_service.delete_theme(db, theme_id)
    except themes_service.ThemeNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/public/themes/{slug}", response_model=PublicThemeOut)
def public_get_theme(
    slug: str,
    db: OrmSession = Depends(get_db),
):
    try:
        return themes_service.public_get_theme(db, slug)
    except themes_service.ThemeNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except themes_service.ThemeBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/public/themes/active", response_model=PublicThemeOut)
def public_get_active_theme(
    db: OrmSession = Depends(get_db),
):
    return themes_service.public_get_active_theme(db)

