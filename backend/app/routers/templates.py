from __future__ import annotations

import json
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


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _default_template_definition(menu: str, footer: str) -> dict:
    rows: list[dict] = []

    if menu.strip() and menu.strip().lower() != "none":
        rows.append(
            {
                "id": "row_header",
                "settings": {"columns": 1, "sizes": [100]},
                "columns": [
                    {
                        "id": "col_header",
                        "blocks": [
                            {
                                "id": "blk_menu_top",
                                "type": "menu",
                                "data": {"menu": menu.strip(), "kind": "top"},
                            }
                        ],
                    }
                ],
            }
        )

    rows.append(
        {
            "id": "row_content",
            "settings": {"columns": 1, "sizes": [100]},
            "columns": [
                {
                    "id": "col_content",
                    "blocks": [
                        {
                            "id": "blk_slot",
                            "type": "slot",
                            "data": {"name": "Page content"},
                        }
                    ],
                }
            ],
        }
    )

    if footer.strip() and footer.strip().lower() != "none":
        rows.append(
            {
                "id": "row_footer",
                "settings": {"columns": 1, "sizes": [100]},
                "columns": [
                    {
                        "id": "col_footer",
                        "blocks": [
                            {
                                "id": "blk_menu_footer",
                                "type": "menu",
                                "data": {"menu": footer.strip(), "kind": "footer"},
                            }
                        ],
                    }
                ],
            }
        )

    return {"version": 3, "layout": {"rows": rows}}


def _to_out(t: PageTemplate) -> TemplateOut:
    definition = _safe_load_json(t.definition_json, {"version": 3, "layout": {"rows": []}})
    return TemplateOut(
        id=t.id,
        slug=t.slug,
        title=t.title,
        description=t.description,
        menu=t.menu,
        footer=t.footer,
        definition=definition,
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

    definition = payload.definition or {"version": 3, "layout": {"rows": []}}
    rows = definition.get("layout", {}).get("rows") if isinstance(definition, dict) else None
    if not isinstance(rows, list) or len(rows) == 0:
        definition = _default_template_definition(payload.menu, payload.footer)

    t = PageTemplate(
        slug=slug,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        menu=payload.menu.strip(),
        footer=payload.footer.strip(),
        definition_json=json.dumps(definition, ensure_ascii=False),
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
    if payload.footer is not None:
        t.footer = payload.footer.strip()
    if payload.definition is not None:
        t.definition_json = json.dumps(payload.definition)

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


@router.get("/api/public/templates/{slug}", response_model=TemplateOut)
def public_get_template(
    slug: str,
    db: OrmSession = Depends(get_db),
):
    slug = validate_template_slug(slug)
    t = db.query(PageTemplate).filter(PageTemplate.slug == slug).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_out(t)
