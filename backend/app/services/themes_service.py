from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.models import Option, Theme
from app.schemas.theme import (
    PublicThemeOut,
    ThemeCreate,
    ThemeListOut,
    ThemeOut,
    ThemeUpdate,
    normalize_css_vars,
    safe_load_vars,
)


class ThemeNotFound(Exception):
    pass


class ThemeConflict(Exception):
    pass


class ThemeBadRequest(Exception):
    pass


def _safe_load_json(text: str | None, fallback: Any) -> Any:
    if not text:
        return fallback
    try:
        return json.loads(text)
    except Exception:
        return fallback


def _safe_dump_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError as exc:
        raise ThemeBadRequest("Value must be JSON-serializable") from exc


def _to_out(t: Theme) -> ThemeOut:
    return ThemeOut(
        id=t.id,
        slug=t.slug,
        title=t.title,
        description=t.description,
        vars=safe_load_vars(t.vars_json),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def list_themes(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    sort: str | None,
    direction: str | None,
) -> ThemeListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Theme)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(Theme.slug).like(qq)
            | func.lower(Theme.title).like(qq)
            | func.lower(Theme.description).like(qq)
        )

    total = base.with_entities(func.count(Theme.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Theme.updated_at,
        "created_at": Theme.created_at,
        "title": func.lower(Theme.title),
        "slug": func.lower(Theme.slug),
        "id": Theme.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Theme.id.asc() if ascending else Theme.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return ThemeListOut(items=[_to_out(t) for t in items], total=total, limit=limit, offset=offset)


def create_theme(db: OrmSession, payload: ThemeCreate) -> ThemeOut:
    p = payload.normalized()
    exists = db.query(Theme).filter(Theme.slug == p.slug).first()
    if exists:
        raise ThemeConflict("Theme slug already exists")

    row = Theme(
        slug=p.slug,
        title=p.title,
        description=p.description,
        vars_json=_safe_dump_json(p.vars),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def get_theme(db: OrmSession, theme_id: int) -> ThemeOut | None:
    row = db.query(Theme).filter(Theme.id == theme_id).first()
    return _to_out(row) if row else None


def update_theme(db: OrmSession, theme_id: int, payload: ThemeUpdate) -> ThemeOut:
    row = db.query(Theme).filter(Theme.id == theme_id).first()
    if not row:
        raise ThemeNotFound("Theme not found")

    p = payload.normalized()
    data = p.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"] and data["slug"] != row.slug:
        exists = db.query(Theme).filter(Theme.slug == data["slug"]).first()
        if exists:
            raise ThemeConflict("Theme slug already exists")
        row.slug = data["slug"]

    if "title" in data and data["title"]:
        row.title = data["title"]

    if "description" in data:
        row.description = data["description"]

    if "vars" in data and data["vars"] is not None:
        row.vars_json = _safe_dump_json(normalize_css_vars(data["vars"]))

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ThemeConflict("Theme slug already exists") from exc

    db.refresh(row)
    return _to_out(row)


def delete_theme(db: OrmSession, theme_id: int) -> None:
    row = db.query(Theme).filter(Theme.id == theme_id).first()
    if not row:
        raise ThemeNotFound("Theme not found")
    db.delete(row)
    db.commit()


def public_get_theme(db: OrmSession, slug: str) -> PublicThemeOut:
    s = (slug or "").strip().lower()
    if not s:
        raise ThemeBadRequest("Theme slug is required")

    t = db.query(Theme).filter(Theme.slug == s).first()
    if not t:
        raise ThemeNotFound("Theme not found")

    return PublicThemeOut(slug=t.slug, title=t.title, vars=safe_load_vars(t.vars_json))


def public_get_active_theme(db: OrmSession) -> PublicThemeOut:
    active_slug = "default"
    active = db.query(Option).filter(Option.key == "appearance.active_theme").first()
    if active:
        v = _safe_load_json(active.value_json, None)
        if isinstance(v, str) and v.strip():
            active_slug = v.strip().lower()

    base_vars: dict[str, str] = {}
    title = active_slug
    t = db.query(Theme).filter(Theme.slug == active_slug).first()
    if t:
        title = t.title
        base_vars = safe_load_vars(t.vars_json)

    override_vars: dict[str, str] = {}
    overrides = db.query(Option).filter(Option.key == "appearance.theme_vars").first()
    if overrides:
        raw = _safe_load_json(overrides.value_json, {})
        if isinstance(raw, dict):
            for k, v in raw.items():
                if not isinstance(k, str) or not k.startswith("--"):
                    continue
                if isinstance(v, str) and v.strip():
                    override_vars[k] = v.strip()
                elif isinstance(v, (int, float)) and not isinstance(v, bool) and v == v:
                    override_vars[k] = str(v)

    merged = {**base_vars, **override_vars}
    return PublicThemeOut(slug=active_slug, title=title, vars=merged)
