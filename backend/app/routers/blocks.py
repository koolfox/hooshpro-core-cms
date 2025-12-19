from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.db import get_db
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


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _to_out(b: BlockTemplate) -> BlockOut:
    definition = _safe_load_json(b.definition_json, {"version": 3, "layout": {"rows": []}})
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
    items = (
        base.order_by(BlockTemplate.updated_at.desc())
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
    payload.normalized()
    slug = validate_block_slug(payload.slug)

    b = BlockTemplate(
        slug=slug,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        definition_json=json.dumps(payload.definition or {"version": 3, "layout": {"rows": []}}),
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
    payload.normalized()

    b = db.query(BlockTemplate).filter(BlockTemplate.id == block_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Block not found")

    if payload.slug is not None:
        b.slug = validate_block_slug(payload.slug)
    if payload.title is not None:
        b.title = payload.title.strip()
    if payload.description is not None:
        b.description = payload.description.strip() if payload.description else None
    if payload.definition is not None:
        b.definition_json = json.dumps(payload.definition)

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

