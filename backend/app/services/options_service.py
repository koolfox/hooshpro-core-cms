from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session as OrmSession

from app.models import Option
from app.schemas.option import (
    OptionListOut,
    OptionOut,
    PublicOptionsOut,
    validate_option_key,
)

# Publicly exposable option keys (mirrors router constant)
PUBLIC_OPTION_KEYS = {
    "general.site_title",
    "general.tagline",
    "reading.front_page_slug",
    "reading.posts_page_slug",
    "appearance.active_theme",
    "appearance.theme_vars",
}


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
        raise ValueError("Option value must be JSON-serializable") from exc


def _to_out(o: Option) -> OptionOut:
    return OptionOut(
        id=o.id,
        key=o.key,
        value=_safe_load_json(o.value_json, None),
        created_at=o.created_at,
        updated_at=o.updated_at,
    )


def _parse_keys_csv(keys: str | None) -> list[str] | None:
    if keys is None:
        return None
    raw = [k.strip() for k in keys.split(",")]
    out: list[str] = []
    for k in raw:
        if not k:
            continue
        out.append(validate_option_key(k))
    if not out:
        return None
    seen: set[str] = set()
    deduped: list[str] = []
    for k in out:
        if k in seen:
            continue
        seen.add(k)
        deduped.append(k)
    return deduped


def list_options(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    keys: str | None,
    sort: str | None,
    direction: str | None,
) -> OptionListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Option)

    key_list = _parse_keys_csv(keys)
    if key_list:
        base = base.filter(Option.key.in_(key_list))

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(Option.key).like(qq))

    total = base.with_entities(func.count(Option.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Option.updated_at,
        "created_at": Option.created_at,
        "key": func.lower(Option.key),
        "id": Option.id,
    }
    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Option.id.asc() if ascending else Option.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return OptionListOut(
        items=[_to_out(o) for o in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_option(db: OrmSession, key: str) -> OptionOut | None:
    k = validate_option_key(key)
    o = db.query(Option).filter(Option.key == k).first()
    return _to_out(o) if o else None


def set_option(db: OrmSession, key: str, value: Any) -> OptionOut:
    k = validate_option_key(key)
    value_json = _safe_dump_json(value)

    o = db.query(Option).filter(Option.key == k).first()
    if not o:
        o = Option(key=k, value_json=value_json)
        db.add(o)
    else:
        o.value_json = value_json

    db.commit()
    db.refresh(o)
    return _to_out(o)


def delete_option(db: OrmSession, key: str) -> None:
    k = validate_option_key(key)
    o = db.query(Option).filter(Option.key == k).first()
    if not o:
        raise LookupError("Option not found")
    db.delete(o)
    db.commit()


def public_get_options(db: OrmSession, keys: str | None) -> PublicOptionsOut:
    requested = _parse_keys_csv(keys) or sorted(PUBLIC_OPTION_KEYS)
    requested = [k for k in requested if k in PUBLIC_OPTION_KEYS]

    if not requested:
        return PublicOptionsOut(options={})

    rows = db.query(Option).filter(Option.key.in_(requested)).all()
    by_key = {o.key: o for o in rows}
    out: dict[str, Any] = {}
    for k in requested:
        o = by_key.get(k)
        if not o:
            continue
        out[k] = _safe_load_json(o.value_json, None)
    return PublicOptionsOut(options=out)
