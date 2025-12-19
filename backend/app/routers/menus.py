from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.db import get_db
from app.deps import get_current_user
from app.models import Menu, MenuItem, Page, User
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
    PublicMenuItemOut,
    PublicMenuOut,
    validate_menu_slug,
)

router = APIRouter(tags=["menus"])


def _to_menu_out(m: Menu) -> MenuOut:
    return MenuOut(
        id=m.id,
        slug=m.slug,
        title=m.title,
        description=m.description,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _to_item_out(it: MenuItem, page: Page | None) -> MenuItemOut:
    return MenuItemOut(
        id=it.id,
        menu_id=it.menu_id,
        type=it.type,
        label=it.label,
        page_id=it.page_id,
        href=it.href,
        order_index=it.order_index,
        page_slug=page.slug if page else None,
        page_title=page.title if page else None,
        created_at=it.created_at,
        updated_at=it.updated_at,
    )


@router.get("/api/admin/menus", response_model=MenuListOut)
def admin_list_menus(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Menu)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(Menu.title).like(qq) | func.lower(Menu.slug).like(qq))

    total = base.with_entities(func.count(Menu.id)).scalar() or 0
    items = (
        base.order_by(Menu.updated_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return MenuListOut(
        items=[_to_menu_out(m) for m in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/api/admin/menus", response_model=MenuOut)
def admin_create_menu(
    payload: MenuCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    m = Menu(
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
    )
    db.add(m)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Menu slug already exists")

    db.refresh(m)
    return _to_menu_out(m)


@router.get("/api/admin/menus/{menu_id}", response_model=MenuOut)
def admin_get_menu(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.query(Menu).filter(Menu.id == menu_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")
    return _to_menu_out(m)


@router.put("/api/admin/menus/{menu_id}", response_model=MenuOut)
def admin_update_menu(
    menu_id: int,
    payload: MenuUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    m = db.query(Menu).filter(Menu.id == menu_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")

    if payload.slug is not None:
        m.slug = payload.slug
    if payload.title is not None:
        m.title = payload.title
    if payload.description is not None:
        m.description = payload.description

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Menu slug already exists")

    db.refresh(m)
    return _to_menu_out(m)


@router.delete("/api/admin/menus/{menu_id}")
def admin_delete_menu(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = db.query(Menu).filter(Menu.id == menu_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")

    if m.slug == "main":
        raise HTTPException(status_code=409, detail="The 'main' menu cannot be deleted.")

    db.delete(m)
    db.commit()
    return {"ok": True}


@router.get("/api/admin/menus/{menu_id}/items", response_model=MenuItemListOut)
def admin_list_menu_items(
    menu_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exists = db.query(Menu.id).filter(Menu.id == menu_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Menu not found")

    rows = (
        db.query(MenuItem, Page)
        .outerjoin(Page, MenuItem.page_id == Page.id)
        .filter(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.order_index.asc(), MenuItem.id.asc())
        .all()
    )
    return MenuItemListOut(items=[_to_item_out(it, p) for it, p in rows])


@router.post("/api/admin/menus/{menu_id}/items", response_model=MenuItemOut)
def admin_create_menu_item(
    menu_id: int,
    payload: MenuItemCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    menu = db.query(Menu).filter(Menu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    page: Page | None = None
    if payload.type == "page":
        page = db.query(Page).filter(Page.id == payload.page_id).first()
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

    next_order = (
        db.query(func.coalesce(func.max(MenuItem.order_index), 0))
        .filter(MenuItem.menu_id == menu_id)
        .scalar()
        or 0
    )

    it = MenuItem(
        menu_id=menu_id,
        type=payload.type,
        label=payload.label,
        page_id=payload.page_id if payload.type == "page" else None,
        href=payload.href if payload.type == "link" else None,
        order_index=int(next_order) + 1,
    )

    db.add(it)
    db.commit()
    db.refresh(it)
    return _to_item_out(it, page)


@router.put("/api/admin/menus/{menu_id}/items/{item_id}", response_model=MenuItemOut)
def admin_update_menu_item(
    menu_id: int,
    item_id: int,
    payload: MenuItemUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    it = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
        .first()
    )
    if not it:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if payload.label is not None:
        it.label = payload.label

    page: Page | None = None
    if it.type == "link":
        if payload.href is not None:
            if not payload.href:
                raise HTTPException(status_code=400, detail="href is required for type=link")
            it.href = payload.href
        if payload.page_id is not None:
            raise HTTPException(status_code=400, detail="page_id is not allowed for type=link")

    if it.type == "page":
        if payload.page_id is not None:
            if payload.page_id <= 0:
                raise HTTPException(status_code=400, detail="page_id is required for type=page")
            page = db.query(Page).filter(Page.id == payload.page_id).first()
            if not page:
                raise HTTPException(status_code=404, detail="Page not found")
            it.page_id = payload.page_id
        else:
            page = db.query(Page).filter(Page.id == it.page_id).first() if it.page_id else None

        if payload.href is not None:
            raise HTTPException(status_code=400, detail="href is not allowed for type=page")

    db.commit()
    db.refresh(it)
    return _to_item_out(it, page)


@router.delete("/api/admin/menus/{menu_id}/items/{item_id}")
def admin_delete_menu_item(
    menu_id: int,
    item_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    it = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
        .first()
    )
    if not it:
        raise HTTPException(status_code=404, detail="Menu item not found")

    db.delete(it)
    db.commit()
    return {"ok": True}


@router.put("/api/admin/menus/{menu_id}/items/reorder")
def admin_reorder_menu_items(
    menu_id: int,
    payload: MenuReorder,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exists = db.query(Menu.id).filter(Menu.id == menu_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Menu not found")

    ids = [int(x) for x in payload.item_ids if int(x) > 0]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="item_ids must be unique")

    items = (
        db.query(MenuItem)
        .filter(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.order_index.asc(), MenuItem.id.asc())
        .all()
    )
    by_id = {it.id: it for it in items}

    ordered: list[MenuItem] = []
    for i in ids:
        it = by_id.get(i)
        if it:
            ordered.append(it)

    # append any omitted items in their current order
    ordered_ids = {it.id for it in ordered}
    for it in items:
        if it.id not in ordered_ids:
            ordered.append(it)

    for idx, it in enumerate(ordered):
        it.order_index = idx

    db.commit()
    return {"ok": True}


@router.get("/api/public/menus/{slug}", response_model=PublicMenuOut)
def public_get_menu(slug: str, db: OrmSession = Depends(get_db)):
    s = slug.strip().lower()
    if s == "none":
        return PublicMenuOut(slug="none", title="none", items=[])

    s = validate_menu_slug(s)
    m = db.query(Menu).filter(Menu.slug == s).first()
    if not m:
        raise HTTPException(status_code=404, detail="Menu not found")

    rows = (
        db.query(MenuItem, Page)
        .outerjoin(Page, MenuItem.page_id == Page.id)
        .filter(MenuItem.menu_id == m.id)
        .order_by(MenuItem.order_index.asc(), MenuItem.id.asc())
        .all()
    )

    out: list[PublicMenuItemOut] = []
    for it, p in rows:
        if it.type == "link":
            href = (it.href or "").strip()
            if not href:
                continue
            out.append(PublicMenuItemOut(label=it.label, href=href))
            continue

        if it.type == "page":
            if not p or p.status != "published":
                continue
            out.append(PublicMenuItemOut(label=it.label, href=f"/{p.slug}"))
            continue

    return PublicMenuOut(slug=m.slug, title=m.title, items=out)

