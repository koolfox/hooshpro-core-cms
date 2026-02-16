from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateOut, TemplateListOut
from app.services import templates_service

router = APIRouter(tags=["templates"])


@router.get("/api/admin/templates", response_model=TemplateListOut)
def admin_list_templates(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return templates_service.list_templates(db, limit, offset, q, sort, dir)


@router.post("/api/admin/templates", response_model=TemplateOut)
def admin_create_template(
    payload: TemplateCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return templates_service.create_template(db, payload)
    except templates_service.TemplateConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/api/admin/templates/{template_id}", response_model=TemplateOut)
def admin_get_template(
    template_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = templates_service.get_template(db, template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.put("/api/admin/templates/{template_id}", response_model=TemplateOut)
def admin_update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return templates_service.update_template(db, template_id, payload)
    except templates_service.TemplateNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except templates_service.TemplateConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/api/admin/templates/{template_id}")
def admin_delete_template(
    template_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        templates_service.delete_template(db, template_id)
    except templates_service.TemplateNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/public/templates/{slug}", response_model=TemplateOut)
def public_get_template(
    slug: str,
    db: OrmSession = Depends(get_db),
):
    t = templates_service.public_get_template(db, slug)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t

