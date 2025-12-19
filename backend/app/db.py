from __future__ import annotations

from pathlib import Path
from typing import Generator
import json
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker, Session as OrmSession

from app.models import Component
from app.core.config import DB_FILE

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
ALEMBIC_BASELINE_REVISION = "79769d50d480"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def _alembic_config() -> Config:
    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    return cfg


def run_migrations() -> None:
    cfg = _alembic_config()

    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    if "alembic_version" not in tables and tables.intersection(
        {"users", "sessions", "pages", "media_assets", "components", "blocks"}
    ):
        command.stamp(cfg, ALEMBIC_BASELINE_REVISION)

    command.upgrade(cfg, "head")


def seed_defaults() -> None:
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
    if "components" not in tables:
        return

    defaults = [
        {
            "slug": "editor",
            "title": "Text",
            "type": "editor",
            "description": "Rich text editor component.",
            "data": {},
        },
        {
            "slug": "button",
            "title": "Button",
            "type": "button",
            "description": "CTA button component.",
            "data": {"label": "Button", "href": "", "variant": "default"},
        },
        {
            "slug": "card",
            "title": "Card",
            "type": "card",
            "description": "Card container with title/body.",
            "data": {"title": "Card", "body": ""},
        },
        {
            "slug": "separator",
            "title": "Divider",
            "type": "separator",
            "description": "Horizontal divider component.",
            "data": {},
        },
        {
            "slug": "image",
            "title": "Image",
            "type": "image",
            "description": "Image component (URL or media picker).",
            "data": {"url": "", "alt": ""},
        },
    ]

    shadcn = [
        "accordion",
        "alert-dialog",
        "alert",
        "aspect-ratio",
        "avatar",
        "badge",
        "breadcrumb",
        "button-group",
        "calendar",
        "carousel",
        "chart",
        "checkbox",
        "collapsible",
        "combobox",
        "command",
        "context-menu",
        "data-table",
        "date-picker",
        "dialog",
        "drawer",
        "dropdown-menu",
        "empty",
        "field",
        "form",
        "hover-card",
        "input-group",
        "input-otp",
        "input",
        "item",
        "kbd",
        "label",
        "menubar",
        "native-select",
        "navigation-menu",
        "pagination",
        "popover",
        "progress",
        "radio-group",
        "resizable",
        "scroll-area",
        "select",
        "sheet",
        "sidebar",
        "skeleton",
        "slider",
        "sonner",
        "spinner",
        "switch",
        "table",
        "tabs",
        "textarea",
        "toast",
        "toggle-group",
        "toggle",
        "tooltip",
        "typography",
    ]
    for cid in shadcn:
        defaults.append(
            {
                "slug": f"shadcn-{cid}",
                "title": f"shadcn/{cid}",
                "type": "shadcn",
                "description": "shadcn/ui component (placeholder).",
                "data": {"component": cid},
            }
        )

    db = SessionLocal()
    try:
        for d in defaults:
            exists = db.query(Component).filter(Component.slug == d["slug"]).first()
            if exists:
                continue
            db.add(
                Component(
                    slug=d["slug"],
                    title=d["title"],
                    type=d["type"],
                    description=d["description"],
                    data_json=json.dumps(d["data"]),
                )
            )
        db.commit()
    finally:
        db.close()


def init_db() -> None:
    run_migrations()
    seed_defaults()


def get_db() -> Generator[OrmSession, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
