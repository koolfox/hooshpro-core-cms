from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.models import Menu, MenuItem, Page
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


class MenuNotFound(Exception):
    pass


class MenuConflict(Exception):
    pass


class MenuBadRequest(Exception):
    pass


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


def list_menus(db: OrmSession, limit: int, offset: int, q: str | None, sort: str | None, direction: str | None) -> MenuListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Menu)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(Menu.title).like(qq) | func.lower(Menu.slug).like(qq))

    total = base.with_entities(func.count(Menu.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Menu.updated_at,
        "created_at": Menu.created_at,
        "title": func.lower(Menu.title),
        "slug": func.lower(Menu.slug),
        "id": Menu.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Menu.id.asc() if ascending else Menu.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()

    return MenuListOut(
        items=[_to_menu_out(m) for m in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def create_menu(db: OrmSession, payload: MenuCreate) -> MenuOut:
    m = Menu(
        slug=validate_menu_slug(payload.slug),
        title=payload.title,
        description=payload.description,
    )
    db.add(m)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise MenuConflict("Menu slug already exists") from exc

    db.refresh(m)
    return _to_menu_out(m)


def get_menu(db: OrmSession, menu_id: int) -> MenuOut | None:
    m = db.query(Menu).filter(Menu.id == menu_id).first()
    return _to_menu_out(m) if m else None


def update_menu(db: OrmSession, menu_id: int, payload: MenuUpdate) -> MenuOut:
    m = db.query(Menu).filter(Menu.id == menu_id).first()
    if not m:
        raise MenuNotFound("Menu not found")

    if payload.slug is not None:
        m.slug = validate_menu_slug(payload.slug)
    if payload.title is not None:
        m.title = payload.title
    if payload.description is not None:
        m.description = payload.description

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise MenuConflict("Menu slug already exists") from exc

    db.refresh(m)
    return _to_menu_out(m)


def delete_menu(db: OrmSession, menu_id: int) -> None:
    m = db.query(Menu).filter(Menu.id == menu_id).first()
    if not m:
        raise MenuNotFound("Menu not found")
    if m.slug == "main":
        raise MenuConflict("The 'main' menu cannot be deleted.")
    db.delete(m)
    db.commit()


def list_menu_items(db: OrmSession, menu_id: int) -> MenuItemListOut:
    exists = db.query(Menu.id).filter(Menu.id == menu_id).first()
    if not exists:
        raise MenuNotFound("Menu not found")

    rows = (
        db.query(MenuItem, Page)
        .outerjoin(Page, MenuItem.page_id == Page.id)
        .filter(MenuItem.menu_id == menu_id)
        .order_by(MenuItem.order_index.asc(), MenuItem.id.asc())
        .all()
    )
    return MenuItemListOut(items=[_to_item_out(it, p) for it, p in rows])


def create_menu_item(db: OrmSession, menu_id: int, payload: MenuItemCreate) -> MenuItemOut:
    menu = db.query(Menu).filter(Menu.id == menu_id).first()
    if not menu:
        raise MenuNotFound("Menu not found")

    page: Page | None = None
    if payload.type == "page":
        page = db.query(Page).filter(Page.id == payload.page_id).first()
        if not page:
            raise MenuNotFound("Page not found")

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


def update_menu_item(db: OrmSession, menu_id: int, item_id: int, payload: MenuItemUpdate) -> MenuItemOut:
    it = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
        .first()
    )
    if not it:
        raise MenuNotFound("Menu item not found")

    if payload.label is not None:
        it.label = payload.label

    page: Page | None = None
    if it.type == "link":
        if payload.href is not None:
            if not payload.href:
                raise MenuBadRequest("href is required for type=link")
            it.href = payload.href
        if payload.page_id is not None:
            raise MenuBadRequest("page_id is not allowed for type=link")

    if it.type == "page":
        if payload.page_id is not None:
            if payload.page_id <= 0:
                raise MenuBadRequest("page_id is required for type=page")
            page = db.query(Page).filter(Page.id == payload.page_id).first()
            if not page:
                raise MenuNotFound("Page not found")
            it.page_id = payload.page_id
        else:
            page = db.query(Page).filter(Page.id == it.page_id).first() if it.page_id else None

        if payload.href is not None:
            raise MenuBadRequest("href is not allowed for type=page")

    db.commit()
    db.refresh(it)
    return _to_item_out(it, page)


def delete_menu_item(db: OrmSession, menu_id: int, item_id: int) -> None:
    it = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.menu_id == menu_id)
        .first()
    )
    if not it:
        raise MenuNotFound("Menu item not found")

    db.delete(it)
    db.commit()


def reorder_menu_items(db: OrmSession, menu_id: int, payload: MenuReorder) -> None:
    exists = db.query(Menu.id).filter(Menu.id == menu_id).first()
    if not exists:
        raise MenuNotFound("Menu not found")

    ids = [int(x) for x in payload.item_ids if int(x) > 0]
    if len(ids) != len(set(ids)):
        raise MenuBadRequest("item_ids must be unique")

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

    ordered_ids = {it.id for it in ordered}
    for it in items:
        if it.id not in ordered_ids:
            ordered.append(it)

    for idx, it in enumerate(ordered):
        it.order_index = idx

    db.commit()


def public_get_menu(db: OrmSession, slug: str) -> PublicMenuOut | None:
    s = slug.strip().lower()
    if s == "none":
        return PublicMenuOut(slug="none", title="none", items=[])

    s = validate_menu_slug(s)
    m = db.query(Menu).filter(Menu.slug == s).first()
    if not m:
        return None

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
            href = "/" if p.slug == "home" else f"/{p.slug}"
            out.append(PublicMenuItemOut(label=it.label, href=href))
            continue

    return PublicMenuOut(slug=m.slug, title=m.title, items=out)
