from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.core.page_builder_validation import (
    CANONICAL_EDITOR_VERSION,
    validate_page_builder_document,
)
from app.db_session import get_db
from app.deps import get_current_user
from app.models import BlockTemplate, User
from app.schemas.block import (
    BlockCreate,
    BlockUpdate,
    BlockOut,
    BlockListOut,
    validate_block_slug,
)

router = APIRouter(tags=["blocks"])


def _empty_definition() -> dict:
    return {
        "version": CANONICAL_EDITOR_VERSION,
        "canvas": {
            "snapPx": 1,
            "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
            "minHeightPx": 800,
        },
        "layout": {"nodes": []},
    }


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _validate_definition(definition: dict) -> dict:
    try:
        return validate_page_builder_document(definition, context="block.definition")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _to_out(b: BlockTemplate) -> BlockOut:
    definition = _safe_load_json(b.definition_json, _empty_definition())
    return BlockOut(
        id=b.id,
        slug=b.slug,
        title=b.title,
        description=b.description,
        definition=definition,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.get("/api/admin/blocks", response_model=BlockListOut)
def admin_list_blocks(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(BlockTemplate)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(BlockTemplate.title).like(qq) | func.lower(BlockTemplate.slug).like(qq)
        )

    total = base.with_entities(func.count(BlockTemplate.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": BlockTemplate.updated_at,
        "created_at": BlockTemplate.created_at,
        "title": func.lower(BlockTemplate.title),
        "slug": func.lower(BlockTemplate.slug),
        "id": BlockTemplate.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (dir or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = BlockTemplate.id.asc() if ascending else BlockTemplate.id.desc()

    items = (
        base.order_by(order, tiebreaker)
        .limit(limit)
        .offset(offset)
        .all()
    )

    return BlockListOut(
        items=[_to_out(b) for b in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/api/admin/blocks", response_model=BlockOut)
def admin_create_block(
    payload: BlockCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
        slug = validate_block_slug(payload.slug)

        definition = payload.definition or _empty_definition()
        validated = _validate_definition(definition)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    b = BlockTemplate(
        slug=slug,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        definition_json=json.dumps(validated, ensure_ascii=False),
    )

    db.add(b)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Block slug already exists")

    db.refresh(b)
    return _to_out(b)


@router.get("/api/admin/blocks/{block_id}", response_model=BlockOut)
def admin_get_block(
    block_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = db.query(BlockTemplate).filter(BlockTemplate.id == block_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")
    return _to_out(b)


@router.put("/api/admin/blocks/{block_id}", response_model=BlockOut)
def admin_update_block(
    block_id: int,
    payload: BlockUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    b = db.query(BlockTemplate).filter(BlockTemplate.id == block_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    try:
        if payload.slug is not None:
            b.slug = validate_block_slug(payload.slug)
        if payload.title is not None:
            b.title = payload.title.strip()
        if payload.description is not None:
            b.description = payload.description.strip() if payload.description else None
        if payload.definition is not None:
            validated = _validate_definition(payload.definition)
            b.definition_json = json.dumps(validated, ensure_ascii=False)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Block slug already exists")

    db.refresh(b)
    return _to_out(b)


@router.delete("/api/admin/blocks/{block_id}")
def admin_delete_block(
    block_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    b = db.query(BlockTemplate).filter(BlockTemplate.id == block_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    db.delete(b)
    db.commit()
    return {"ok": True}
