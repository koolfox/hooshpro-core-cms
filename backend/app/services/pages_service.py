from __future__ import annotations

import json
from datetime import datetime, timezone
from html import escape as escape_html
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.core.page_builder_validation import (
    CANONICAL_EDITOR_VERSION,
    validate_page_builder_document,
)
from app.models import Page
from app.schemas.page import PageCreate, PageUpdate, PageOut, PageListOut, validate_slug


class PageConflictError(Exception):
    pass


class PageNotFoundError(Exception):
    pass


class PageValidationError(Exception):
    pass


# -------- helpers ------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _empty_builder_document() -> dict:
    return {
        "version": CANONICAL_EDITOR_VERSION,
        "canvas": {
            "snapPx": 1,
            "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
            "minHeightPx": 800,
        },
        "layout": {"nodes": []},
    }


def _safe_load_blocks(blocks_json: str | None) -> dict:
    if not blocks_json:
        return _empty_builder_document()

    try:
        parsed = json.loads(blocks_json)
    except Exception:
        return _empty_builder_document()

    try:
        return validate_page_builder_document(parsed, context="page.blocks")
    except ValueError:
        return _empty_builder_document()


def _extract_body(blocks: dict) -> str:
    """Best-effort body extraction from canonical editor nodes only."""
    if not isinstance(blocks, dict):
        return ""

    version = blocks.get("version")
    if version not in (4, CANONICAL_EDITOR_VERSION):
        return ""

    layout = blocks.get("layout") if isinstance(blocks.get("layout"), dict) else {}
    nodes = layout.get("nodes") if isinstance(layout.get("nodes"), list) else []

    html_parts: list[str] = []
    text_parts: list[str] = []

    def walk(items: Iterable) -> None:
        for b in items:
            if not isinstance(b, dict):
                continue

            b_type = b.get("type")
            data = b.get("data") if isinstance(b.get("data"), dict) else {}

            if b_type in ("editor", "tiptap"):
                html = data.get("html")
                if isinstance(html, str) and html.strip():
                    html_parts.append(html)

            if b_type in ("text", "typography"):
                text = data.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())

            nested = b.get("nodes")
            if isinstance(nested, list):
                walk(nested)

            children = b.get("children")
            if isinstance(children, list):
                walk(children)

    walk(nodes)

    if html_parts:
        return "".join(html_parts)

    if text_parts:
        return "".join(f"<p>{escape_html(t)}</p>" for t in text_parts)

    return ""


def _validate_blocks_payload(blocks: dict, *, context: str) -> dict:
    try:
        return validate_page_builder_document(blocks, context=context)
    except ValueError as exc:
        raise PageValidationError(str(exc)) from exc


def _to_out(p: Page) -> PageOut:
    blocks = _safe_load_blocks(p.blocks_json)
    body = _extract_body(blocks)
    return PageOut(
        id=p.id,
        title=p.title,
        slug=p.slug,
        status=p.status,
        seo_title=p.seo_title,
        seo_description=p.seo_description,
        body=body,
        blocks=blocks,
        published_at=p.published_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# -------- public API ---------------------------------------------------------

def list_pages(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    status: str | None,
    sort: str | None,
    direction: str | None,
) -> PageListOut:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    base = db.query(Page)

    if status in ("draft", "published"):
        base = base.filter(Page.status == status)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(Page.title).like(qq) | func.lower(Page.slug).like(qq)
        )

    total = base.with_entities(func.count(Page.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": Page.updated_at,
        "created_at": Page.created_at,
        "published_at": Page.published_at,
        "title": func.lower(Page.title),
        "slug": func.lower(Page.slug),
        "status": Page.status,
        "id": Page.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = Page.id.asc() if ascending else Page.id.desc()

    items = (
        base.order_by(order, tiebreaker)
        .limit(limit)
        .offset(offset)
        .all()
    )

    return PageListOut(
        items=[_to_out(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def get_page_by_slug(db: OrmSession, slug: str) -> PageOut | None:
    slug = validate_slug(slug)
    p = db.query(Page).filter(Page.slug == slug).first()
    return _to_out(p) if p else None


def get_page(db: OrmSession, page_id: int) -> PageOut | None:
    p = db.query(Page).filter(Page.id == page_id).first()
    return _to_out(p) if p else None


def create_page(db: OrmSession, payload: PageCreate) -> PageOut:
    if payload.blocks is None:
        raise PageValidationError(
            "page.blocks is required and must follow the canonical editor schema."
        )

    blocks = _validate_blocks_payload(payload.blocks, context="page.blocks")

    p = Page(
        title=payload.title,
        slug=validate_slug(payload.slug),
        status=payload.status,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        blocks_json=json.dumps(blocks, ensure_ascii=False),
        published_at=_utcnow() if payload.status == "published" else None,
    )

    db.add(p)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "UNIQUE constraint failed: pages.slug" in str(exc):
            raise PageConflictError("Slug already exists") from exc
        raise

    db.refresh(p)
    return _to_out(p)


def update_page(db: OrmSession, page_id: int, payload: PageUpdate) -> PageOut:
    p = db.query(Page).filter(Page.id == page_id).first()
    if not p:
        raise PageNotFoundError("Page not found")

    if payload.slug is not None:
        p.slug = validate_slug(payload.slug)
    if payload.title is not None:
        p.title = payload.title
    if payload.status is not None:
        p.status = payload.status
    if payload.seo_title is not None:
        p.seo_title = payload.seo_title
    if payload.seo_description is not None:
        p.seo_description = payload.seo_description

    if payload.blocks is not None:
        validated = _validate_blocks_payload(payload.blocks, context="page.blocks")
        p.blocks_json = json.dumps(validated, ensure_ascii=False)
    elif payload.body is not None:
        raise PageValidationError(
            "Legacy body updates are not supported. Send page.blocks instead."
        )

    if payload.status == "published" and not p.published_at:
        p.published_at = _utcnow()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "UNIQUE constraint failed: pages.slug" in str(exc):
            raise PageConflictError("Slug already exists") from exc
        raise

    db.refresh(p)
    return _to_out(p)


def delete_page(db: OrmSession, page_id: int) -> None:
    p = db.query(Page).filter(Page.id == page_id).first()
    if not p:
        return
    db.delete(p)
    db.commit()


def get_public_page_by_slug(db: OrmSession, slug: str) -> PageOut | None:
    slug = validate_slug(slug)
    p = (
        db.query(Page)
        .filter(Page.slug == slug, Page.status == "published")
        .first()
    )
    return _to_out(p) if p else None


def list_public_pages(
    db: OrmSession,
    limit: int,
    offset: int,
) -> PageListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Page).filter(Page.status == "published")
    total = base.with_entities(func.count(Page.id)).scalar() or 0

    items = (
        base.order_by(Page.updated_at.desc(), Page.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return PageListOut(
        items=[_to_out(p) for p in items],
        total=total,
        limit=limit,
        offset=offset,
    )
