from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.db import get_db
from app.deps import get_current_user
from app.models import PageTemplate, User
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateOut,
    TemplateListOut,
    validate_template_slug,
)

router = APIRouter(tags=["templates"])


def _to_out(t: PageTemplate) -> TemplateOut:
    return TemplateOut(
        id=t.id,
        slug=t.slug,
        title=t.title,
        description=t.description,
        menu=t.menu,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("/api/admin/templates", response_model=TemplateListOut)
def admin_list_templates(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(PageTemplate)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(PageTemplate.title).like(qq) | func.lower(PageTemplate.slug).like(qq)
        )

    total = base.with_entities(func.count(PageTemplate.id)).scalar() or 0
    items = (
        base.order_by(PageTemplate.updated_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return TemplateListOut(
        items=[_to_out(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/api/admin/templates", response_model=TemplateOut)
def admin_create_template(
    payload: TemplateCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    slug = validate_template_slug(payload.slug)

    t = PageTemplate(
        slug=slug,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        menu=payload.menu.strip(),
    )

    db.add(t)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template slug already exists")

    db.refresh(t)
    return _to_out(t)


@router.get("/api/admin/templates/{template_id}", response_model=TemplateOut)
def admin_get_template(
    template_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_out(t)


@router.put("/api/admin/templates/{template_id}", response_model=TemplateOut)
def admin_update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()

    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.slug is not None:
        t.slug = validate_template_slug(payload.slug)
    if payload.title is not None:
        t.title = payload.title.strip()
    if payload.description is not None:
        t.description = payload.description.strip() if payload.description else None
    if payload.menu is not None:
        t.menu = payload.menu.strip()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Template slug already exists")

    db.refresh(t)
    return _to_out(t)


@router.delete("/api/admin/templates/{template_id}")
def admin_delete_template(
    template_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    db.delete(t)
    db.commit()
    return {"ok": True}

