from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.db import get_db
from app.deps import get_current_user
from app.models import Component, User
from app.schemas.component import (
    ComponentCreate,
    ComponentUpdate,
    ComponentOut,
    ComponentListOut,
    validate_component_slug,
)

router = APIRouter(tags=["components"])


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _to_out(c: Component) -> ComponentOut:
    data = _safe_load_json(c.data_json, {})
    return ComponentOut(
        id=c.id,
        slug=c.slug,
        title=c.title,
        type=c.type,
        description=c.description,
        data=data,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("/api/admin/components", response_model=ComponentListOut)
def admin_list_components(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    type: str | None = None,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(Component)

    if type:
        base = base.filter(Component.type == type.strip())

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(Component.title).like(qq) | func.lower(Component.slug).like(qq)
        )

    total = base.with_entities(func.count(Component.id)).scalar() or 0
    items = (
        base.order_by(Component.updated_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return ComponentListOut(
        items=[_to_out(c) for c in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/api/admin/components", response_model=ComponentOut)
def admin_create_component(
    payload: ComponentCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    slug = validate_component_slug(payload.slug)

    c = Component(
        slug=slug,
        title=payload.title.strip(),
        type=payload.type.strip(),
        description=payload.description.strip() if payload.description else None,
        data_json=json.dumps(payload.data or {}),
    )

    db.add(c)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Component slug already exists")

    db.refresh(c)
    return _to_out(c)


@router.get("/api/admin/components/{component_id}", response_model=ComponentOut)
def admin_get_component(
    component_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Component).filter(Component.id == component_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Component not found")
    return _to_out(c)


@router.put("/api/admin/components/{component_id}", response_model=ComponentOut)
def admin_update_component(
    component_id: int,
    payload: ComponentUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    c = db.query(Component).filter(Component.id == component_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Component not found")

    if payload.slug is not None:
        c.slug = validate_component_slug(payload.slug)
    if payload.title is not None:
        c.title = payload.title.strip()
    if payload.type is not None:
        c.type = payload.type.strip()
    if payload.description is not None:
        c.description = payload.description.strip() if payload.description else None
    if payload.data is not None:
        c.data_json = json.dumps(payload.data)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Component slug already exists")

    db.refresh(c)
    return _to_out(c)


@router.delete("/api/admin/components/{component_id}")
def admin_delete_component(
    component_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.query(Component).filter(Component.id == component_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Component not found")

    db.delete(c)
    db.commit()
    return {"ok": True}

