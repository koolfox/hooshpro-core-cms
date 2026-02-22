from __future__ import annotations

import json
from typing import Any

from sqlalchemy import inspect

from app.models import ContentField, ContentType, Option


DEFAULT_OPTIONS: dict[str, Any] = {
    "general.site_title": "HooshPro",
    "general.tagline": "Shape-first CMS",
    "reading.front_page_slug": "home",
    "reading.posts_page_slug": "blog",
    "appearance.active_theme": "default",
    "appearance.theme_vars": {},
}


CONTACT_SUBMISSION_TYPE = {
    "slug": "contact_submissions",
    "title": "Contact Submissions",
    "description": "Inbound contact requests captured by flow-form blocks.",
    "fields": [
        {
            "slug": "name",
            "label": "Name",
            "field_type": "string",
            "required": True,
            "options": {},
        },
        {
            "slug": "email",
            "label": "Email",
            "field_type": "string",
            "required": True,
            "options": {},
        },
        {
            "slug": "phone",
            "label": "Phone",
            "field_type": "string",
            "required": False,
            "options": {},
        },
        {
            "slug": "message",
            "label": "Message",
            "field_type": "text",
            "required": True,
            "options": {},
        },
        {
            "slug": "source",
            "label": "Source",
            "field_type": "string",
            "required": False,
            "options": {},
        },
    ],
}


def _seed_options(db) -> None:
    for key, value in DEFAULT_OPTIONS.items():
        existing = db.query(Option).filter(Option.key == key).first()
        if existing:
            continue
        db.add(Option(key=key, value_json=json.dumps(value, ensure_ascii=False)))


def _seed_contact_submissions_type(db) -> None:
    slug = CONTACT_SUBMISSION_TYPE["slug"]
    existing = db.query(ContentType).filter(ContentType.slug == slug).first()

    if existing is None:
        existing = ContentType(
            slug=slug,
            title=CONTACT_SUBMISSION_TYPE["title"],
            description=CONTACT_SUBMISSION_TYPE["description"],
        )
        db.add(existing)
        db.flush()

    current_fields = {
        row.slug: row
        for row in db.query(ContentField)
        .filter(ContentField.content_type_id == existing.id)
        .all()
    }

    for index, field in enumerate(CONTACT_SUBMISSION_TYPE["fields"]):
        field_slug = str(field["slug"])
        if field_slug in current_fields:
            continue

        db.add(
            ContentField(
                content_type_id=existing.id,
                slug=field_slug,
                label=str(field["label"]),
                field_type=str(field["field_type"]),
                required=bool(field["required"]),
                options_json=json.dumps(field.get("options") or {}, ensure_ascii=False),
                order_index=index,
            )
        )


def seed_defaults(engine, SessionLocal) -> None:  # type: ignore
    """Seed minimal runtime defaults (no visual/demo content)."""
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    if "options" not in tables and not {"content_types", "content_fields"}.issubset(tables):
        return

    db = SessionLocal()
    try:
        if "options" in tables:
            _seed_options(db)

        if {"content_types", "content_fields"}.issubset(tables):
            _seed_contact_submissions_type(db)

        db.commit()
    finally:
        db.close()
