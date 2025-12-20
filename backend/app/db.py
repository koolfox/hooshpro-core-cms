from __future__ import annotations

from pathlib import Path
from typing import Generator
import json
from datetime import datetime, timezone
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker, Session as OrmSession

from app.models import Component, Menu, MenuItem, Page, PageTemplate
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

    known_tables = {
        "users",
        "sessions",
        "pages",
        "page_templates",
        "components",
        "blocks",
        "media_assets",
        "media_folders",
        "menus",
        "menu_items",
    }
    baseline_tables = {"users", "sessions", "pages"}

    if "alembic_version" not in tables and tables.intersection(known_tables):
        # If the DB was created before migrations were wired (e.g. via `create_all`),
        # stamp to an appropriate revision so we don't try to recreate existing tables.
        has_non_baseline = bool(tables.intersection(known_tables - baseline_tables))
        if has_non_baseline:
            from alembic.script import ScriptDirectory

            head = ScriptDirectory.from_config(cfg).get_current_head()
            if not head:
                raise RuntimeError("Alembic head revision not found")
            command.stamp(cfg, head)
        else:
            command.stamp(cfg, ALEMBIC_BASELINE_REVISION)

    command.upgrade(cfg, "head")


def seed_defaults() -> None:
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    db = SessionLocal()
    try:
        home_page: Page | None = None
        if "pages" in tables:
            home_page = db.query(Page).filter(Page.slug == "home").first()

            has_pages = db.query(Page.id).limit(1).first() is not None
            if not has_pages:
                blocks = {
                    "version": 1,
                    "blocks": [
                        {"type": "hero", "data": {"headline": "Home", "subheadline": ""}},
                        {
                            "type": "paragraph",
                            "data": {
                                "text": "Welcome to HooshPro. Edit this page at /?edit=1.",
                            },
                        },
                    ],
                }
                home_page = Page(
                    title="Home",
                    slug="home",
                    status="published",
                    blocks_json=json.dumps(blocks, ensure_ascii=False),
                    published_at=datetime.now(timezone.utc),
                )
                db.add(home_page)
                db.flush()

        if "menus" in tables:
            main = db.query(Menu).filter(Menu.slug == "main").first()
            if not main:
                main = Menu(
                    slug="main",
                    title="Main",
                    description="Primary site navigation.",
                )
                db.add(main)
                db.flush()

            if "menu_items" in tables:
                has_home_link = (
                    db.query(MenuItem.id)
                    .filter(MenuItem.menu_id == main.id, MenuItem.type == "link", MenuItem.href == "/")
                    .first()
                    is not None
                )
                has_home_page = (
                    db.query(MenuItem.id)
                    .join(Page, MenuItem.page_id == Page.id)
                    .filter(MenuItem.menu_id == main.id, MenuItem.type == "page", Page.slug == "home")
                    .first()
                    is not None
                )
                has_home = has_home_link or has_home_page
                if not has_home:
                    if home_page is not None:
                        db.add(
                            MenuItem(
                                menu_id=main.id,
                                type="page",
                                label="Home",
                                page_id=home_page.id,
                                order_index=0,
                            )
                        )
                    else:
                        db.add(
                            MenuItem(
                                menu_id=main.id,
                                type="link",
                                label="Home",
                                href="/",
                                order_index=0,
                            )
                        )

        if "page_templates" in tables:
            template_defaults = [
                {
                    "slug": "default",
                    "title": "Default",
                    "description": "Default site layout.",
                    "menu": "main",
                    "footer": "none",
                },
                {
                    "slug": "blank",
                    "title": "Blank",
                    "description": "No header (menu: none).",
                    "menu": "none",
                    "footer": "none",
                },
            ]
            for d in template_defaults:
                exists = db.query(PageTemplate).filter(PageTemplate.slug == d["slug"]).first()
                if exists:
                    continue
                db.add(
                    PageTemplate(
                        slug=d["slug"],
                        title=d["title"],
                        description=d["description"],
                        menu=d["menu"],
                        footer=d["footer"],
                    )
                )

        if "components" in tables:
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
