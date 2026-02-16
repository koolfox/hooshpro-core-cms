from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.models import ContentEntry, ContentField, ContentType
from app.schemas.content import (
    ContentEntryCreate,
    ContentEntryListOut,
    ContentEntryOut,
    ContentEntryUpdate,
    ContentFieldCreate,
    ContentFieldListOut,
    ContentFieldOut,
    ContentFieldReorderIn,
    ContentFieldUpdate,
    ContentTypeCreate,
    ContentTypeListOut,
    ContentTypeOut,
    ContentTypeUpdate,
    PublicContentEntryListOut,
    PublicContentEntryOut,
    dump_entry_data,
    dump_field_options,
    load_entry_data,
    load_field_options,
    validate_field_type,
)
from app.schemas.page import validate_slug


class CollectionNotFound(Exception):
    pass


class CollectionConflict(Exception):
    pass


class CollectionBadRequest(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_type_out(ct: ContentType) -> ContentTypeOut:
    return ContentTypeOut(
        id=ct.id,
        slug=ct.slug,
        title=ct.title,
        description=ct.description,
        created_at=ct.created_at,
        updated_at=ct.updated_at,
    )


def _to_field_out(f: ContentField) -> ContentFieldOut:
    return ContentFieldOut(
        id=f.id,
        content_type_id=f.content_type_id,
        slug=f.slug,
        label=f.label,
        field_type=f.field_type,
        required=bool(f.required),
        options=load_field_options(f.options_json),
        order_index=f.order_index,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


def _to_entry_out(e: ContentEntry, content_type_slug: str) -> ContentEntryOut:
    return ContentEntryOut(
        id=e.id,
        content_type_id=e.content_type_id,
        content_type_slug=content_type_slug,
        title=e.title,
        slug=e.slug,
        status=e.status,
        order_index=e.order_index,
        data=load_entry_data(e.data_json),
        published_at=e.published_at,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )


def _to_public_entry_out(e: ContentEntry, content_type_slug: str) -> PublicContentEntryOut:
    return PublicContentEntryOut(
        id=e.id,
        content_type_slug=content_type_slug,
        title=e.title,
        slug=e.slug,
        data=load_entry_data(e.data_json),
        published_at=e.published_at,
    )


def _load_content_type_by_slug(db: OrmSession, slug: str) -> ContentType:
    slug = validate_slug(slug)
    ct = db.query(ContentType).filter(ContentType.slug == slug).first()
    if not ct:
        raise CollectionNotFound("Content type not found")
    return ct


def _load_fields(db: OrmSession, content_type_id: int) -> list[ContentField]:
    return (
        db.query(ContentField)
        .filter(ContentField.content_type_id == content_type_id)
        .order_by(ContentField.order_index.asc(), ContentField.id.asc())
        .all()
    )


def _validate_entry_data(fields: list[ContentField], data: dict) -> dict:
    if not isinstance(data, dict):
        raise CollectionBadRequest("data must be an object")

    out = dict(data)

    for f in fields:
        key = f.slug
        val = out.get(key)

        if f.required:
            missing = val is None or (isinstance(val, str) and not val.strip())
            if missing:
                raise CollectionBadRequest(f"Field '{key}' is required")

        if val is None:
            continue

        ft = validate_field_type(f.field_type)
        if ft in ("string", "text", "datetime", "select"):
            if not isinstance(val, str):
                raise CollectionBadRequest(f"Field '{key}' must be a string")
            if ft == "select":
                opts = load_field_options(f.options_json)
                allowed = opts.get("options")
                if not isinstance(allowed, list):
                    allowed = opts.get("values")
                if isinstance(allowed, list):
                    allowed_set = {str(x) for x in allowed}
                    if val not in allowed_set:
                        raise CollectionBadRequest(f"Field '{key}' must be one of {sorted(allowed_set)}")
        elif ft == "number":
            if isinstance(val, bool) or not isinstance(val, (int, float)):
                raise CollectionBadRequest(f"Field '{key}' must be a number")
        elif ft == "boolean":
            if not isinstance(val, bool):
                raise CollectionBadRequest(f"Field '{key}' must be a boolean")
        elif ft == "media":
            if not isinstance(val, int):
                raise CollectionBadRequest(f"Field '{key}' must be a media id (number)")

    return out


# ---- Content Types ----------------------------------------------------------

def list_content_types(db: OrmSession, limit: int, offset: int, q: str | None, sort: str | None, direction: str | None) -> ContentTypeListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(ContentType)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(ContentType.title).like(qq) | func.lower(ContentType.slug).like(qq))

    total = base.with_entities(func.count(ContentType.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": ContentType.updated_at,
        "created_at": ContentType.created_at,
        "title": func.lower(ContentType.title),
        "slug": func.lower(ContentType.slug),
        "id": ContentType.id,
    }
    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = ContentType.id.asc() if ascending else ContentType.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return ContentTypeListOut(items=[_to_type_out(ct) for ct in items], total=total, limit=limit, offset=offset)


def create_content_type(db: OrmSession, payload: ContentTypeCreate) -> ContentTypeOut:
    ct = ContentType(slug=payload.slug, title=payload.title, description=payload.description)
    db.add(ct)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Content type slug already exists") from exc
    db.refresh(ct)
    return _to_type_out(ct)


def get_content_type(db: OrmSession, type_id: int) -> ContentTypeOut | None:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    return _to_type_out(ct) if ct else None


def update_content_type(db: OrmSession, type_id: int, payload: ContentTypeUpdate) -> ContentTypeOut:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    if payload.slug is not None:
        ct.slug = payload.slug
    if payload.title is not None:
        ct.title = payload.title
    if payload.description is not None:
        ct.description = payload.description

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Content type slug already exists") from exc

    db.refresh(ct)
    return _to_type_out(ct)


def delete_content_type(db: OrmSession, type_id: int) -> None:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    has_entries = (
        db.query(ContentEntry.id)
        .filter(ContentEntry.content_type_id == ct.id)
        .limit(1)
        .first()
        is not None
    )
    if has_entries:
        raise CollectionConflict("Content type has entries; delete them first")

    db.delete(ct)
    db.commit()


# ---- Fields -----------------------------------------------------------------

def list_fields(db: OrmSession, type_id: int) -> ContentFieldListOut:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")
    fields = _load_fields(db, ct.id)
    return ContentFieldListOut(items=[_to_field_out(f) for f in fields])


def create_field(db: OrmSession, type_id: int, payload: ContentFieldCreate) -> ContentFieldOut:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    max_order = db.query(func.max(ContentField.order_index)).filter(ContentField.content_type_id == ct.id).scalar()
    next_order = int(max_order or 0) + 1

    f = ContentField(
        content_type_id=ct.id,
        slug=payload.slug,
        label=payload.label,
        field_type=payload.field_type,
        required=bool(payload.required),
        options_json=dump_field_options(payload.options),
        order_index=next_order,
    )

    db.add(f)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Field slug already exists for this content type") from exc

    db.refresh(f)
    return _to_field_out(f)


def update_field(db: OrmSession, type_id: int, field_id: int, payload: ContentFieldUpdate) -> ContentFieldOut:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    f = (
        db.query(ContentField)
        .filter(ContentField.id == field_id, ContentField.content_type_id == ct.id)
        .first()
    )
    if not f:
        raise CollectionNotFound("Field not found")

    if payload.slug is not None:
        f.slug = payload.slug
    if payload.label is not None:
        f.label = payload.label
    if payload.field_type is not None:
        f.field_type = payload.field_type
    if payload.required is not None:
        f.required = bool(payload.required)
    if payload.options is not None:
        f.options_json = dump_field_options(payload.options)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Field slug already exists for this content type") from exc

    db.refresh(f)
    return _to_field_out(f)


def delete_field(db: OrmSession, type_id: int, field_id: int) -> None:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    f = (
        db.query(ContentField)
        .filter(ContentField.id == field_id, ContentField.content_type_id == ct.id)
        .first()
    )
    if not f:
        raise CollectionNotFound("Field not found")

    db.delete(f)
    db.commit()


def reorder_fields(db: OrmSession, type_id: int, payload: ContentFieldReorderIn) -> None:
    ct = db.query(ContentType).filter(ContentType.id == type_id).first()
    if not ct:
        raise CollectionNotFound("Content type not found")

    ids = [int(i) for i in payload.ids]
    fields = (
        db.query(ContentField)
        .filter(ContentField.content_type_id == ct.id, ContentField.id.in_(ids))
        .all()
    )
    if len(fields) != len(set(ids)):
        raise CollectionBadRequest("All field ids must belong to this content type")

    by_id = {f.id: f for f in fields}
    for idx, fid in enumerate(ids):
        by_id[fid].order_index = idx

    db.commit()


# ---- Entries ----------------------------------------------------------------

def list_entries(
    db: OrmSession,
    type_slug: str | None,
    limit: int,
    offset: int,
    q: str | None,
    status: str | None,
    sort: str | None,
    direction: str | None,
) -> ContentEntryListOut:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    base = db.query(ContentEntry, ContentType.slug).join(ContentType, ContentEntry.content_type_id == ContentType.id)

    if type_slug:
        base = base.filter(ContentType.slug == validate_slug(type_slug))

    if status in ("draft", "published"):
        base = base.filter(ContentEntry.status == status)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(ContentEntry.title).like(qq) | func.lower(ContentEntry.slug).like(qq)
        )

    total = base.with_entities(func.count(ContentEntry.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": ContentEntry.updated_at,
        "created_at": ContentEntry.created_at,
        "published_at": ContentEntry.published_at,
        "title": func.lower(ContentEntry.title),
        "slug": func.lower(ContentEntry.slug),
        "status": ContentEntry.status,
        "order_index": ContentEntry.order_index,
        "id": ContentEntry.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = ContentEntry.id.asc() if ascending else ContentEntry.id.desc()

    rows = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    items = [_to_entry_out(e, type_slug or type_slug_from_row) for (e, type_slug_from_row) in rows]

    return ContentEntryListOut(items=items, total=total, limit=limit, offset=offset)


def create_entry(db: OrmSession, payload: ContentEntryCreate) -> ContentEntryOut:
    ct = _load_content_type_by_slug(db, payload.content_type_slug)
    fields = _load_fields(db, ct.id)
    data = _validate_entry_data(fields, payload.data)

    e = ContentEntry(
        content_type_id=ct.id,
        title=payload.title,
        slug=payload.slug,
        status=payload.status,
        order_index=payload.order_index,
        data_json=dump_entry_data(data),
        published_at=_utcnow() if payload.status == "published" else None,
    )

    db.add(e)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Entry slug already exists for this content type") from exc

    db.refresh(e)
    return _to_entry_out(e, ct.slug)


def get_entry(db: OrmSession, entry_id: int) -> ContentEntryOut | None:
    row = (
        db.query(ContentEntry, ContentType.slug)
        .join(ContentType, ContentEntry.content_type_id == ContentType.id)
        .filter(ContentEntry.id == entry_id)
        .first()
    )
    if not row:
        return None
    e, type_slug = row
    return _to_entry_out(e, type_slug)


def update_entry(db: OrmSession, entry_id: int, payload: ContentEntryUpdate) -> ContentEntryOut:
    row = (
        db.query(ContentEntry, ContentType.slug)
        .join(ContentType, ContentEntry.content_type_id == ContentType.id)
        .filter(ContentEntry.id == entry_id)
        .first()
    )
    if not row:
        raise CollectionNotFound("Entry not found")

    e, type_slug = row
    fields = _load_fields(db, e.content_type_id)

    if payload.title is not None:
        e.title = payload.title
    if payload.slug is not None:
        e.slug = payload.slug
    if payload.order_index is not None:
        e.order_index = payload.order_index
    if payload.data is not None:
        e.data_json = dump_entry_data(_validate_entry_data(fields, payload.data))

    if payload.status is not None:
        e.status = payload.status
        if payload.status == "published":
            e.published_at = e.published_at or _utcnow()
        else:
            e.published_at = None

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise CollectionConflict("Entry slug already exists for this content type") from exc

    db.refresh(e)
    return _to_entry_out(e, type_slug)


def delete_entry(db: OrmSession, entry_id: int) -> None:
    e = db.query(ContentEntry).filter(ContentEntry.id == entry_id).first()
    if not e:
        raise CollectionNotFound("Entry not found")
    db.delete(e)
    db.commit()


# ---- Public -----------------------------------------------------------------

def public_list_entries(
    db: OrmSession,
    type_slug: str,
    limit: int,
    offset: int,
    sort: str | None,
    direction: str | None,
) -> PublicContentEntryListOut:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    ct = _load_content_type_by_slug(db, type_slug)

    base = db.query(ContentEntry).filter(
        ContentEntry.content_type_id == ct.id,
        ContentEntry.status == "published",
    )

    total = base.with_entities(func.count(ContentEntry.id)).scalar() or 0

    allowed_sorts = {
        "published_at": ContentEntry.published_at,
        "updated_at": ContentEntry.updated_at,
        "created_at": ContentEntry.created_at,
        "title": func.lower(ContentEntry.title),
        "slug": func.lower(ContentEntry.slug),
        "order_index": ContentEntry.order_index,
        "id": ContentEntry.id,
    }

    sort_key = (sort or "published_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["published_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = ContentEntry.id.asc() if ascending else ContentEntry.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return PublicContentEntryListOut(
        items=[_to_public_entry_out(e, ct.slug) for e in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def public_get_entry(db: OrmSession, type_slug: str, entry_slug: str) -> PublicContentEntryOut | None:
    ct = _load_content_type_by_slug(db, type_slug)
    slug = validate_slug(entry_slug)

    e = db.query(ContentEntry).filter(
        ContentEntry.content_type_id == ct.id,
        ContentEntry.slug == slug,
        ContentEntry.status == "published",
    ).first()
    if not e:
        return None

    return _to_public_entry_out(e, ct.slug)
