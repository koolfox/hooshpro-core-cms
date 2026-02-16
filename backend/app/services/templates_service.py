from __future__ import annotations

import json

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as OrmSession

from app.core.page_builder_validation import validate_page_builder_document
from app.models import PageTemplate
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateOut,
    TemplateListOut,
    validate_template_slug,
)


class TemplateNotFound(Exception):
    pass


class TemplateConflict(Exception):
    pass


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _default_template_definition(menu: str, footer: str) -> dict:
    canvas = {
        "snapPx": 1,
        "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
        "minHeightPx": 800,
    }

    nodes: list[dict] = []
    y = 0

    if menu.strip() and menu.strip().lower() != "none":
        nodes.append(
            {
                "id": "node_menu_top",
                "type": "menu",
                "data": {"menu": menu.strip(), "kind": "top"},
                "frames": {
                    "mobile": {"x": 0, "y": y, "w": canvas["widths"]["mobile"], "h": 96},
                    "tablet": {"x": 0, "y": y, "w": canvas["widths"]["tablet"], "h": 96},
                    "desktop": {"x": 0, "y": y, "w": canvas["widths"]["desktop"], "h": 96},
                },
            }
        )
        y += 120

    nodes.append(
        {
            "id": "node_slot",
            "type": "slot",
            "data": {"name": "Page content"},
            "frames": {
                "mobile": {"x": 0, "y": y, "w": canvas["widths"]["mobile"], "h": 1200},
                "tablet": {"x": 0, "y": y, "w": canvas["widths"]["tablet"], "h": 1200},
                "desktop": {"x": 0, "y": y, "w": canvas["widths"]["desktop"], "h": 1200},
            },
        }
    )
    y += 1240

    if footer.strip() and footer.strip().lower() != "none":
        nodes.append(
            {
                "id": "node_menu_footer",
                "type": "menu",
                "data": {"menu": footer.strip(), "kind": "footer"},
                "frames": {
                    "mobile": {"x": 0, "y": y, "w": canvas["widths"]["mobile"], "h": 96},
                    "tablet": {"x": 0, "y": y, "w": canvas["widths"]["tablet"], "h": 96},
                    "desktop": {"x": 0, "y": y, "w": canvas["widths"]["desktop"], "h": 96},
                },
            }
        )

    return {"version": 4, "canvas": canvas, "layout": {"nodes": nodes}}


def _to_out(t: PageTemplate) -> TemplateOut:
    definition = _safe_load_json(
        t.definition_json,
        {
            "version": 4,
            "canvas": {
                "snapPx": 1,
                "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
                "minHeightPx": 800,
            },
            "layout": {"nodes": []},
        },
    )
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


def list_templates(
    db: OrmSession,
    limit: int,
    offset: int,
    q: str | None,
    sort: str | None,
    direction: str | None,
) -> TemplateListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    base = db.query(PageTemplate)

    if q:
        qq = f"%{q.strip().lower()}%"
        base = base.filter(
            func.lower(PageTemplate.title).like(qq) | func.lower(PageTemplate.slug).like(qq)
        )

    total = base.with_entities(func.count(PageTemplate.id)).scalar() or 0

    allowed_sorts = {
        "updated_at": PageTemplate.updated_at,
        "created_at": PageTemplate.created_at,
        "title": func.lower(PageTemplate.title),
        "slug": func.lower(PageTemplate.slug),
        "menu": func.lower(PageTemplate.menu),
        "footer": func.lower(PageTemplate.footer),
        "id": PageTemplate.id,
    }

    sort_key = (sort or "updated_at").strip().lower()
    sort_dir = (direction or "desc").strip().lower()
    sort_col = allowed_sorts.get(sort_key) or allowed_sorts["updated_at"]
    ascending = sort_dir == "asc"

    order = sort_col.asc() if ascending else sort_col.desc()
    tiebreaker = PageTemplate.id.asc() if ascending else PageTemplate.id.desc()

    items = base.order_by(order, tiebreaker).limit(limit).offset(offset).all()

    return TemplateListOut(
        items=[_to_out(x) for x in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def create_template(db: OrmSession, payload: TemplateCreate) -> TemplateOut:
    slug = validate_template_slug(payload.slug)

    definition = payload.definition or {
        "version": 4,
        "canvas": {
            "snapPx": 1,
            "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
            "minHeightPx": 800,
        },
        "layout": {"nodes": []},
    }
    definition = validate_page_builder_document(definition, context="template.definition")
    nodes = definition.get("layout", {}).get("nodes") if isinstance(definition, dict) else None
    if not isinstance(nodes, list) or len(nodes) == 0:
        definition = _default_template_definition(payload.menu, payload.footer)
    definition = validate_page_builder_document(definition, context="template.definition")

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
    except IntegrityError as exc:
        db.rollback()
        raise TemplateConflict("Template slug already exists") from exc

    db.refresh(t)
    return _to_out(t)


def get_template(db: OrmSession, template_id: int) -> TemplateOut | None:
    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    return _to_out(t) if t else None


def update_template(db: OrmSession, template_id: int, payload: TemplateUpdate) -> TemplateOut:
    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    if not t:
        raise TemplateNotFound("Template not found")

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
        validated = validate_page_builder_document(payload.definition, context="template.definition")
        t.definition_json = json.dumps(validated, ensure_ascii=False)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise TemplateConflict("Template slug already exists") from exc

    db.refresh(t)
    return _to_out(t)


def delete_template(db: OrmSession, template_id: int) -> None:
    t = db.query(PageTemplate).filter(PageTemplate.id == template_id).first()
    if not t:
        raise TemplateNotFound("Template not found")
    db.delete(t)
    db.commit()


def public_get_template(db: OrmSession, slug: str) -> TemplateOut | None:
    s = validate_template_slug(slug)
    t = db.query(PageTemplate).filter(PageTemplate.slug == s).first()
    return _to_out(t) if t else None
