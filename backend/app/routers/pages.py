from __future__ import annotations

import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.db import get_db
from app.deps import get_current_user
from app.models import Page, User
from app.schemas.page import (
    PageCreate,
    PageUpdate,
    PageOut,
    PageListOut,
    validate_slug,
)

router = APIRouter(tags=["pages"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_load_blocks(blocks_json: str | None) -> dict:
    if not blocks_json:
        return {"version": 1, "blocks": []}
    try:
        return json.loads(blocks_json)
    except Exception:
        return {"version": 1, "blocks": []}


def _extract_body(blocks: dict) -> str:
    """
    Legacy body extractor:
    - If our blocks contain "editor"/legacy "tiptap" html, try to return a plain-ish fallback.
    - Otherwise if blocks contain "paragraph" with text.
    """
    version = blocks.get("version")

    # v3 grid layout: { layout: { rows: [ { columns: [ { blocks: [...] } ] } ] } }
    if version == 3:
        def walk_block_list(items: list, out: list[str]) -> None:
            for b in items:
                if not isinstance(b, dict):
                    continue

                if b.get("type") in ("editor", "tiptap"):
                    data = b.get("data") or {}
                    if isinstance(data, dict):
                        html = data.get("html") or ""
                        if html:
                            out.append(str(html))

                children = b.get("children")
                if isinstance(children, list):
                    walk_block_list(children, out)

        layout = blocks.get("layout") or {}
        rows = layout.get("rows") or []
        parts: list[str] = []
        for r in rows:
            if not isinstance(r, dict):
                continue
            cols = r.get("columns") or []
            for c in cols:
                if not isinstance(c, dict):
                    continue
                c_blocks = c.get("blocks") or []
                if isinstance(c_blocks, list):
                    walk_block_list(c_blocks, parts)
        if parts:
            return "".join(parts)

    for b in (blocks.get("blocks") or []):
        if b.get("type") in ("editor", "tiptap"):
            data = b.get("data") or {}
            html = data.get("html") or ""
            return str(html)

    for b in (blocks.get("blocks") or []):
        if b.get("type") == "paragraph":
            data = b.get("data") or {}
            return str(data.get("text") or "")

    return ""


def _build_blocks_legacy(title: str, body: str) -> dict:
    return {
        "version": 1,
        "blocks": [
            {"type": "hero", "data": {"headline": title, "subheadline": ""}},
            {"type": "paragraph", "data": {"text": body or ""}},
        ],
    }


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


@router.get("/api/admin/pages", response_model=PageListOut)
def admin_list_pages(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    q: str | None = None,
    status: str | None = None,
):
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

    items = (
        base.order_by(Page.updated_at.desc())
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


@router.get("/api/admin/pages/by-slug/{slug}", response_model=PageOut)
def admin_get_page_by_slug(
    slug: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    slug = validate_slug(slug)
    p = db.query(Page).filter(Page.slug == slug).first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return _to_out(p)


@router.post("/api/admin/pages", response_model=PageOut)
def admin_create_page(
    payload: PageCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    slug = validate_slug(payload.slug)

    if payload.blocks is not None:
        blocks = payload.blocks
    else:
        blocks = _build_blocks_legacy(payload.title, payload.body)

    p = Page(
        title=payload.title,
        slug=slug,
        status=payload.status,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        blocks_json=json.dumps(blocks, ensure_ascii=False),
        published_at=utcnow() if payload.status == "published" else None,
    )

    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug already exists")

    db.refresh(p)
    return _to_out(p)


@router.get("/api/admin/pages/{page_id}", response_model=PageOut)
def admin_get_page(
    page_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = db.query(Page).filter(Page.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return _to_out(p)


@router.put("/api/admin/pages/{page_id}", response_model=PageOut)
def admin_update_page(
    page_id: int,
    payload: PageUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    p = db.query(Page).filter(Page.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")

    if payload.title is not None:
        p.title = payload.title

    if payload.slug is not None:
        p.slug = validate_slug(payload.slug)

    if payload.status is not None:
        p.status = payload.status
        if payload.status == "published" and p.published_at is None:
            p.published_at = utcnow()
        if payload.status == "draft":
            p.published_at = None

    if payload.seo_title is not None:
        p.seo_title = payload.seo_title

    if payload.seo_description is not None:
        p.seo_description = payload.seo_description

    if payload.blocks is not None:
        p.blocks_json = json.dumps(payload.blocks, ensure_ascii=False)
    elif payload.body is not None:
        blocks = _build_blocks_legacy(p.title, payload.body)
        p.blocks_json = json.dumps(blocks, ensure_ascii=False)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slug already exists")

    db.refresh(p)
    return _to_out(p)


@router.delete("/api/admin/pages/{page_id}")
def admin_delete_page(
    page_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = db.query(Page).filter(Page.id == page_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/api/public/pages/{slug}", response_model=PageOut)
def public_get_page(slug: str, db: OrmSession = Depends(get_db)):
    slug = validate_slug(slug)
    p = (
        db.query(Page)
        .filter(Page.slug == slug, Page.status == "published")
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return _to_out(p)
