from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.menu import (
    MenuCreate,
    MenuItemCreate,
    MenuItemListOut,
    MenuItemOut,
    MenuItemUpdate,
    MenuListOut,
    MenuOut,
    MenuReorder,
    MenuUpdate,
    PublicMenuOut,
)
from app.services import menus_service

router = APIRouter(tags=["menus"])


@router.get("/api/admin/menus", response_model=MenuListOut)
def admin_list_menus(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return menus_service.list_menus(db, limit, offset, q, sort, dir)


@router.post("/api/admin/menus", response_model=MenuOut)
def admin_create_menu(
    payload: MenuCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return menus_service.create_menu(db, payload)
    except menus_service.MenuConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/api/admin/menus/{menu_id}", response_model=MenuOut)
def admin_get_menu(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = menus_service.get_menu(db, menu_id)
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")
    return m


@router.put("/api/admin/menus/{menu_id}", response_model=MenuOut)
def admin_update_menu(
    menu_id: int,
    payload: MenuUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return menus_service.update_menu(db, menu_id, payload)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except menus_service.MenuConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/api/admin/menus/{menu_id}")
def admin_delete_menu(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        menus_service.delete_menu(db, menu_id)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except menus_service.MenuConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/menus/{menu_id}/items", response_model=MenuItemListOut)
def admin_list_menu_items(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return menus_service.list_menu_items(db, menu_id)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/api/admin/menus/{menu_id}/items", response_model=MenuItemOut)
def admin_create_menu_item(
    menu_id: int,
    payload: MenuItemCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return menus_service.create_menu_item(db, menu_id, payload)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/api/admin/menus/{menu_id}/items/{item_id}", response_model=MenuItemOut)
def admin_update_menu_item(
    menu_id: int,
    item_id: int,
    payload: MenuItemUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return menus_service.update_menu_item(db, menu_id, item_id, payload)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except menus_service.MenuBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/menus/{menu_id}/items/{item_id}")
def admin_delete_menu_item(
    menu_id: int,
    item_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        menus_service.delete_menu_item(db, menu_id, item_id)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.put("/api/admin/menus/{menu_id}/items/reorder")
def admin_reorder_menu_items(
    menu_id: int,
    payload: MenuReorder,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        menus_service.reorder_menu_items(db, menu_id, payload)
    except menus_service.MenuNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except menus_service.MenuBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


@router.get("/api/public/menus/{slug}", response_model=PublicMenuOut)
def public_get_menu(slug: str, db: OrmSession = Depends(get_db)):
    m = menus_service.public_get_menu(db, slug)
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")
    return m

