from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.models import ContentEntry, Taxonomy, Term, TermRelationship
from app.schemas.page import validate_slug
from app.schemas.taxonomy import (
    EntryTermListOut,
    EntryTermOut,
    EntryTermSetIn,
    PublicTermListOut,
    PublicTermOut,
    TaxonomyCreate,
    TaxonomyListOut,
    TaxonomyOut,
    TaxonomyUpdate,
    TermCreate,
    TermListOut,
    TermOut,
    TermUpdate,
)


class TaxonomyNotFound(Exception):
    pass


class TaxonomyConflict(Exception):
    pass


class TaxonomyBadRequest(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_tax_out(t: Taxonomy) -> TaxonomyOut:
    return TaxonomyOut(
        id=t.id,
        slug=t.slug,
        title=t.title,
        description=t.description,
        hierarchical=bool(t.hierarchical),
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def _to_term_out(t: Term) -> TermOut:
    return TermOut(
        id=t.id,
        taxonomy_id=t.taxonomy_id,
        parent_id=t.parent_id,
        slug=t.slug,
        title=t.title,
        description=t.description,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def list_taxonomies(db: OrmSession, limit: int, offset: int, q: str | None, sort: str | None, direction: str | None) -> TaxonomyListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Taxonomy)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(Taxonomy.title).like(qq) | func.lower(Taxonomy.slug).like(qq))

    total = base.with_entities(func.count(Taxonomy.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Taxonomy.updated_at,
        "created_at": Taxonomy.created_at,
        "title": func.lower(Taxonomy.title),
        "slug": func.lower(Taxonomy.slug),
        "id": Taxonomy.id,
    }
    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Taxonomy.id.asc() if ascending else Taxonomy.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return TaxonomyListOut(
        items=[_to_tax_out(t) for t in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def create_taxonomy(db: OrmSession, payload: TaxonomyCreate) -> TaxonomyOut:
    t = Taxonomy(
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        hierarchical=bool(payload.hierarchical),
    )
    db.add(t)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise TaxonomyConflict("Taxonomy slug already exists") from exc
    db.refresh(t)
    return _to_tax_out(t)


def get_taxonomy(db: OrmSession, taxonomy_id: int) -> TaxonomyOut | None:
    t = db.query(Taxonomy).filter(Taxonomy.id == taxonomy_id).first()
    return _to_tax_out(t) if t else None


def update_taxonomy(db: OrmSession, taxonomy_id: int, payload: TaxonomyUpdate) -> TaxonomyOut:
    t = db.query(Taxonomy).filter(Taxonomy.id == taxonomy_id).first()
    if not t:
        raise TaxonomyNotFound("Taxonomy not found")

    if payload.slug is not None:
        t.slug = payload.slug
    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description
    if payload.hierarchical is not None:
        t.hierarchical = bool(payload.hierarchical)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise TaxonomyConflict("Taxonomy slug already exists") from exc

    db.refresh(t)
    return _to_tax_out(t)


def delete_taxonomy(db: OrmSession, taxonomy_id: int) -> None:
    t = db.query(Taxonomy).filter(Taxonomy.id == taxonomy_id).first()
    if not t:
        raise TaxonomyNotFound("Taxonomy not found")

    term_ids = [tid for (tid,) in db.query(Term.id).filter(Term.taxonomy_id == taxonomy_id).all()]
    if term_ids:
        db.query(TermRelationship).filter(TermRelationship.term_id.in_(term_ids)).delete(synchronize_session=False)
        db.query(Term).filter(Term.id.in_(term_ids)).delete(synchronize_session=False)

    db.delete(t)
    db.commit()


# ---- Terms ------------------------------------------------------------------

def list_terms(db: OrmSession, taxonomy_id: int, limit: int, offset: int, q: str | None, sort: str | None, direction: str | None) -> TermListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    exists = db.query(Taxonomy.id).filter(Taxonomy.id == taxonomy_id).first()
    if not exists:
        raise TaxonomyNotFound("Taxonomy not found")

    base = db.query(Term).filter(Term.taxonomy_id == taxonomy_id)
    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(func.lower(Term.title).like(qq) | func.lower(Term.slug).like(qq))

    total = base.with_entities(func.count(Term.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Term.updated_at,
        "created_at": Term.created_at,
        "title": func.lower(Term.title),
        "slug": func.lower(Term.slug),
        "id": Term.id,
    }
    sort_key = (sort or "title").strip().lower()
    sort_dir = (direction or "asc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["title"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Term.id.asc() if ascending else Term.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()
    return TermListOut(items=[_to_term_out(it) for it in items], total=total, limit=limit, offset=offset)


def create_term(db: OrmSession, taxonomy_id: int, payload: TermCreate) -> TermOut:
    exists = db.query(Taxonomy.id).filter(Taxonomy.id == taxonomy_id).first()
    if not exists:
        raise TaxonomyNotFound("Taxonomy not found")

    parent_id = payload.parent_id
    if parent_id is not None:
        parent = db.query(Term).filter(Term.id == parent_id, Term.taxonomy_id == taxonomy_id).first()
        if not parent:
            raise TaxonomyNotFound("Parent term not found")

    t = Term(
        taxonomy_id=taxonomy_id,
        parent_id=parent_id,
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
    )
    db.add(t)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise TaxonomyConflict("Term slug already exists for this taxonomy") from exc

    db.refresh(t)
    return _to_term_out(t)


def update_term(db: OrmSession, taxonomy_id: int, term_id: int, payload: TermUpdate) -> TermOut:
    t = db.query(Term).filter(Term.id == term_id, Term.taxonomy_id == taxonomy_id).first()
    if not t:
        raise TaxonomyNotFound("Term not found")

    if payload.slug is not None:
        t.slug = payload.slug
    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description

    parent_provided = False
    if hasattr(payload, "model_fields_set"):
        parent_provided = "parent_id" in payload.model_fields_set  # type: ignore[attr-defined]
    elif hasattr(payload, "__fields_set__"):
        parent_provided = "parent_id" in payload.__fields_set__  # type: ignore[attr-defined]

    if parent_provided:
        if payload.parent_id is None:
            t.parent_id = None
        else:
            if payload.parent_id == term_id:
                raise TaxonomyBadRequest("parent_id cannot reference itself")
            parent = (
                db.query(Term)
                .filter(Term.id == payload.parent_id, Term.taxonomy_id == taxonomy_id)
                .first()
            )
            if not parent:
                raise TaxonomyNotFound("Parent term not found")
            t.parent_id = payload.parent_id

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise TaxonomyConflict("Term slug already exists for this taxonomy") from exc

    db.refresh(t)
    return _to_term_out(t)


def delete_term(db: OrmSession, taxonomy_id: int, term_id: int) -> None:
    t = db.query(Term).filter(Term.id == term_id, Term.taxonomy_id == taxonomy_id).first()
    if not t:
        raise TaxonomyNotFound("Term not found")

    db.query(TermRelationship).filter(TermRelationship.term_id == term_id).delete(synchronize_session=False)
    db.delete(t)
    db.commit()


# ---- Entry-term relationships ----------------------------------------------

def get_entry_terms(db: OrmSession, entry_id: int) -> EntryTermListOut:
    exists = db.query(ContentEntry.id).filter(ContentEntry.id == entry_id).first()
    if not exists:
        raise TaxonomyNotFound("Entry not found")

    rows = (
        db.query(Term, Taxonomy)
        .join(Taxonomy, Term.taxonomy_id == Taxonomy.id)
        .join(TermRelationship, TermRelationship.term_id == Term.id)
        .filter(TermRelationship.content_entry_id == entry_id)
        .order_by(func.lower(Taxonomy.slug).asc(), func.lower(Term.title).asc(), Term.id.asc())
        .all()
    )

    items: list[EntryTermOut] = []
    for term, tax in rows:
        items.append(
            EntryTermOut(
                id=term.id,
                taxonomy_id=tax.id,
                taxonomy_slug=tax.slug,
                taxonomy_title=tax.title,
                slug=term.slug,
                title=term.title,
            )
        )

    return EntryTermListOut(items=items)


def set_entry_terms(db: OrmSession, entry_id: int, payload: EntryTermSetIn) -> EntryTermListOut:
    exists = db.query(ContentEntry.id).filter(ContentEntry.id == entry_id).first()
    if not exists:
        raise TaxonomyNotFound("Entry not found")

    ids = [int(x) for x in payload.term_ids if int(x) > 0]
    if len(ids) != len(set(ids)):
        raise TaxonomyBadRequest("term_ids must be unique")

    if ids:
        found = {tid for (tid,) in db.query(Term.id).filter(Term.id.in_(ids)).all()}
        missing = [tid for tid in ids if tid not in found]
        if missing:
            raise TaxonomyNotFound(f"Terms not found: {missing}")

    existing = (
        db.query(TermRelationship.term_id)
        .filter(TermRelationship.content_entry_id == entry_id)
        .all()
    )
    existing_ids = {tid for (tid,) in existing}

    desired = set(ids)
    to_remove = sorted(existing_ids - desired)
    to_add = [tid for tid in ids if tid not in existing_ids]

    if to_remove:
        db.query(TermRelationship).filter(
            TermRelationship.content_entry_id == entry_id,
            TermRelationship.term_id.in_(to_remove),
        ).delete(synchronize_session=False)

    for tid in to_add:
        db.add(TermRelationship(term_id=tid, content_entry_id=entry_id, created_at=_utcnow()))

    db.commit()
    return get_entry_terms(db, entry_id)


# ---- Public ----------------------------------------------------------------

def public_list_terms(db: OrmSession, taxonomy_slug: str) -> PublicTermListOut:
    slug = validate_slug(taxonomy_slug)
    tax = db.query(Taxonomy).filter(Taxonomy.slug == slug).first()
    if not tax:
        raise TaxonomyNotFound("Taxonomy not found")

    rows = (
        db.query(Term)
        .filter(Term.taxonomy_id == tax.id)
        .order_by(func.lower(Term.title).asc(), Term.id.asc())
        .all()
    )
    return PublicTermListOut(
        items=[
            PublicTermOut(
                id=t.id,
                taxonomy_slug=tax.slug,
                slug=t.slug,
                title=t.title,
                description=t.description,
            )
            for t in rows
        ]
    )
