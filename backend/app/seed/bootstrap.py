from __future__ import annotations

import html
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import inspect

from app.config import settings
from app.core.page_builder_validation import CANONICAL_EDITOR_VERSION
from app.models import (
    Component,
    ContentField,
    ContentType,
    MediaAsset,
    MediaFolder,
    Menu,
    MenuItem,
    Option,
    Page,
    PageTemplate,
    Theme,
    Taxonomy,
)


def seed_defaults(engine, SessionLocal) -> None:  # type: ignore
    """Seed demo data and defaults. Requires engine + SessionLocal passed in."""
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    db = SessionLocal()
    try:
        seed_assets_root = Path(__file__).resolve().parent.parent / "seed_assets"

        def now_utc() -> datetime:
            return datetime.now(timezone.utc)

        def ensure_media_file(rel: Path, src: Path) -> int:
            dest = Path(settings.MEDIA_DIR) / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                shutil.copyfile(src, dest)
            return int(dest.stat().st_size)

        def ensure_media_folder(name: str, parent_id: int | None) -> MediaFolder | None:
            if "media_folders" not in tables:
                return None
            base = db.query(MediaFolder).filter(MediaFolder.name == name[:200])
            if parent_id is None:
                base = base.filter(MediaFolder.parent_id.is_(None))
            else:
                base = base.filter(MediaFolder.parent_id == parent_id)
            existing = base.first()
            if existing:
                return existing
            f = MediaFolder(name=name[:200], parent_id=parent_id)
            db.add(f)
            db.flush()
            return f

        def ensure_media_asset(filename: str, folder_id: int | None = None) -> MediaAsset | None:
            if "media_assets" not in tables:
                return None

            rel = Path("seed") / "jeweler" / filename
            stored = str(rel).replace("\\", "/")

            existing = db.query(MediaAsset).filter(MediaAsset.stored_name == stored).first()
            if existing:
                return existing

            src = seed_assets_root / "jeweler" / filename
            if not src.exists():
                return None

            size = ensure_media_file(rel, src)

            m = MediaAsset(
                folder_id=folder_id,
                original_name=filename[:400],
                stored_name=stored[:400],
                content_type="image/svg+xml",
                size_bytes=size,
            )
            db.add(m)
            db.flush()
            return m

        def tiptap_value(segments: list[tuple[str, str]]) -> dict:
            doc_nodes: list[dict] = []
            html_parts: list[str] = []

            for tag, text in segments:
                t = (text or "").strip()
                safe = html.escape(t)
                if tag.startswith("h") and len(tag) == 2 and tag[1].isdigit():
                    level = int(tag[1])
                    doc_nodes.append(
                        {
                            "type": "heading",
                            "attrs": {"level": level},
                            "content": [{"type": "text", "text": t}],
                        }
                    )
                    html_parts.append(f"<{tag}>{safe}</{tag}>")
                    continue

                if tag == "blockquote":
                    doc_nodes.append(
                        {
                            "type": "blockquote",
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": t}],
                                }
                            ],
                        }
                    )
                    html_parts.append(f"<blockquote><p>{safe}</p></blockquote>")
                    continue

                doc_nodes.append(
                    {"type": "paragraph", "content": [{"type": "text", "text": t or ""}]}
                )
                html_parts.append(f"<p>{safe}</p>")

            return {
                "type": "doc",
                "content": doc_nodes,
                "html": "".join(html_parts),
            }

        def ensure_option(key: str, value: Any) -> None:
            if "options" not in tables:
                return
            existing = db.query(Option).filter(Option.key == key).first()
            if existing:
                return
            db.add(Option(key=key, value_json=json.dumps(value, ensure_ascii=False)))
            db.flush()

        def ensure_theme(slug: str, title: str, vars: dict[str, str], description: str | None) -> None:
            if "themes" not in tables:
                return
            existing = db.query(Theme).filter(Theme.slug == slug).first()
            if existing:
                return
            db.add(
                Theme(
                    slug=slug,
                    title=title,
                    description=description,
                    vars_json=json.dumps(vars, ensure_ascii=False),
                )
            )
            db.flush()

        def ensure_taxonomy(slug: str, title: str, description: str | None) -> Taxonomy | None:
            if "taxonomies" not in tables:
                return None
            existing = db.query(Taxonomy).filter(Taxonomy.slug == slug).first()
            if existing:
                return existing
            t = Taxonomy(slug=slug, title=title, description=description)
            db.add(t)
            db.flush()
            return t

        def ensure_field(
            ctype: ContentType,
            slug: str,
            label: str,
            field_type: str,
            required: bool = False,
            options: dict | None = None,
            order_index: int = 0,
        ) -> ContentField:
            existing = (
                db.query(ContentField)
                .filter(ContentField.content_type_id == ctype.id, ContentField.slug == slug)
                .first()
            )
            if existing:
                return existing

            f = ContentField(
                content_type_id=ctype.id,
                slug=slug,
                label=label,
                field_type=field_type,
                required=required,
                options_json=json.dumps(options or {}, ensure_ascii=False),
                order_index=order_index,
            )
            db.add(f)
            db.flush()
            return f
        def ensure_page(title: str, slug: str, status: str, blocks: dict) -> Page:
            existing = db.query(Page).filter(Page.slug == slug).first()
            if existing:
                return existing
            p = Page(
                title=title,
                slug=slug,
                status=status,
                blocks_json=json.dumps(blocks, ensure_ascii=False),
                published_at=now_utc() if status == "published" else None,
                created_at=now_utc(),
            )
            db.add(p)
            db.flush()
            return p

        # Media folders + assets
        seed_media: dict[str, MediaAsset | None] = {}
        if "media_assets" in tables:
            jeweler_folder = ensure_media_folder("Jeweler", None)
            if jeweler_folder:
                for name in ["hero.svg", "diamond.svg", "gold.svg", "ring.svg", "necklace.svg", "watch.svg", "gift.svg", "store.svg"]:
                    seed_media[name] = ensure_media_asset(name, jeweler_folder.id)

        # Options
        ensure_option("general.site_title", "HooshPro")
        ensure_option("general.tagline", "Shape-first CMS")
        ensure_option("reading.front_page_slug", "home")
        ensure_option("appearance.active_theme", "jeweler")
        ensure_option("appearance.theme_vars", {})

        # Themes
        ensure_theme(
            "jeweler",
            "Jeweler",
            {
                "--jeweler-bg0": "#020202",
                "--jeweler-bg1": "#0a0a0a",
                "--jeweler-bg2": "#111010",
                "--jeweler-panel": "#0f0f10",
                "--jeweler-line": "rgb(255 255 255 / 0.1)",
                "--jeweler-gold": "#c8b79a",
                "--jeweler-gold2": "#948376",
                "--jeweler-text": "rgb(255 255 255 / 0.88)",
                "--jeweler-muted": "rgb(255 255 255 / 0.55)",
                "--jeweler-container": "1180px",
                "--jeweler-shadow": "0 20px 60px rgb(0 0 0 / 0.55)",
            },
            "Luxury demo theme (matches the seeded Jeweler homepage/template).",
        )

        # Taxonomy sample
        ensure_taxonomy("category", "Categories", "Sample category taxonomy")

        # Content types (minimal)
        if "content_types" in tables:
            existing_ct = db.query(ContentType).filter(ContentType.slug == "post").first()
            if not existing_ct:
                ct = ContentType(slug="post", title="Post", description="Blog posts")
                db.add(ct)
                db.flush()
                ensure_field(ct, "title", "Title", "text", required=True, order_index=0)
                ensure_field(ct, "body", "Body", "richtext", required=True, order_index=1)

        # Menu seed
        if "menus" in tables:
            main_menu = db.query(Menu).filter(Menu.slug == "main").first()
            if not main_menu:
                main_menu = Menu(slug="main", title="Main", description="Primary navigation")
                db.add(main_menu)
                db.flush()

            def ensure_menu_link(label: str, href: str, order_index: int) -> None:
                existing = (
                    db.query(MenuItem)
                    .filter(MenuItem.menu_id == main_menu.id, MenuItem.label == label, MenuItem.href == href)
                    .first()
                )
                if existing:
                    return
                db.add(MenuItem(menu_id=main_menu.id, type="link", label=label, href=href, order_index=order_index))
                db.flush()

            def ensure_footer_link(label: str, href: str, order_index: int) -> None:
                footer = db.query(Menu).filter(Menu.slug == "footer").first()
                if not footer:
                    footer = Menu(slug="footer", title="Footer", description="Footer navigation")
                    db.add(footer)
                    db.flush()
                existing = (
                    db.query(MenuItem)
                    .filter(MenuItem.menu_id == footer.id, MenuItem.label == label, MenuItem.href == href)
                    .first()
                )
                if existing:
                    return
                db.add(MenuItem(menu_id=footer.id, type="link", label=label, href=href, order_index=order_index))
                db.flush()

            ensure_menu_link("Jeweler", "#top", 0)
            ensure_menu_link("Our Products", "#products", 1)
            ensure_menu_link("Our Services", "#services", 2)
            ensure_menu_link("Contact", "#contact", 3)
            ensure_footer_link("About", "#about", 0)
            ensure_footer_link("Contact", "#contact", 1)
        # Templates and pages (demo)

        # Basic components registry (minimal)
        if "components" in tables:
            if not db.query(Component).filter(Component.slug == "hero").first():
                db.add(Component(slug="hero", title="Hero", type="frame", description="Hero section", data_json="{}"))
            if not db.query(Component).filter(Component.slug == "feature-grid").first():
                db.add(Component(slug="feature-grid", title="Feature Grid", type="frame", description="Grid of features", data_json="{}"))
            db.flush()

        if "page_templates" in tables:
            tpl = db.query(PageTemplate).filter(PageTemplate.slug == "jeweler").first()
            if not tpl:
                tpl_def = {
                    "version": CANONICAL_EDITOR_VERSION,
                    "canvas": {"snapPx": 1, "widths": {"mobile": 390, "tablet": 820, "desktop": 1200}, "minHeightPx": 800},
                    "layout": {"nodes": []},
                }
                tpl = PageTemplate(
                    slug="jeweler",
                    title="Jeweler Template",
                    description="Demo template",
                    menu="main",
                    footer="footer",
                    definition_json=json.dumps(tpl_def, ensure_ascii=False),
                )
                db.add(tpl)
                db.flush()

        if "pages" in tables:
            seed_canvas = {
                "snapPx": 1,
                "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
                "minHeightPx": 800,
            }
            hero_img_url = f"{settings.MEDIA_URL_PREFIX}/seed/jeweler/hero.svg"

            seed_home_blocks = {
                "version": CANONICAL_EDITOR_VERSION,
                "template": {"id": "jeweler", "menu": "main", "footer": "footer"},
                "canvas": seed_canvas,
                "layout": {
                    "nodes": [
                        {
                            "id": "hero",
                            "type": "frame",
                            "meta": {"name": "Hero"},
                            "data": {"layout": "box", "className": "jeweler-hero"},
                            "frames": {
                                "mobile": {"x": 0, "y": 0, "w": seed_canvas["widths"]["mobile"], "h": 520},
                                "tablet": {"x": 0, "y": 0, "w": seed_canvas["widths"]["tablet"], "h": 520},
                                "desktop": {"x": 0, "y": 0, "w": seed_canvas["widths"]["desktop"], "h": 520},
                            },
                            "nodes": [
                                {
                                    "id": "hero-img",
                                    "type": "image",
                                    "data": {"url": hero_img_url, "alt": "Hero"},
                                    "frames": {
                                        "mobile": {"x": 0, "y": 0, "w": seed_canvas["widths"]["mobile"] * 0.95, "h": 360},
                                        "tablet": {"x": 0, "y": 0, "w": seed_canvas["widths"]["tablet"] * 0.55, "h": 520},
                                        "desktop": {"x": 0, "y": 0, "w": seed_canvas["widths"]["desktop"] * 0.55, "h": 520},
                                    },
                                },
                                {
                                    "id": "hero-text",
                                    "type": "text",
                                    "data": {"variant": "h1", "text": "Premium handmade jewellery on every occasion"},
                                    "frames": {
                                        "mobile": {"x": 16, "y": 380, "w": seed_canvas["widths"]["mobile"] - 32, "h": 120},
                                        "tablet": {"x": seed_canvas["widths"]["tablet"] * 0.58, "y": 80, "w": seed_canvas["widths"]["tablet"] * 0.36, "h": 180},
                                        "desktop": {"x": seed_canvas["widths"]["desktop"] * 0.58, "y": 80, "w": seed_canvas["widths"]["desktop"] * 0.36, "h": 180},
                                    },
                                },
                            ],
                        }
                    ]
                },
            }

            ensure_page("Home", "home", "published", seed_home_blocks)

        db.commit()
    finally:
        db.close()





