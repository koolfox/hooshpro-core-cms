from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

from sqlalchemy import or_

from app.db_session import SessionLocal
from app.models import (
    BlockTemplate,
    Component,
    ContentEntry,
    ContentField,
    ContentType,
    MediaAsset,
    MediaFolder,
    Menu,
    MenuItem,
    Option,
    Page,
    PageTemplate,
    Taxonomy,
    Term,
    TermRelationship,
    Theme,
)
from app.seed.bootstrap import seed_defaults


@dataclass
class CleanupStats:
    pages: int = 0
    templates: int = 0
    menus: int = 0
    menu_items: int = 0
    media_assets: int = 0
    media_folders: int = 0
    themes: int = 0
    components: int = 0
    blocks: int = 0
    content_types: int = 0
    content_fields: int = 0
    content_entries: int = 0
    taxonomies: int = 0
    terms: int = 0
    term_relationships: int = 0
    options_reset: int = 0


def _targeted_cleanup(db, write: bool) -> CleanupStats:
    stats = CleanupStats()

    slug_patterns = ["demo-%", "sample-%", "starter-%", "test-%", "tmp-%"]
    value_re = re.compile(r"(?i)(demo|sample|starter|test|tmp)")

    page_q = db.query(Page).filter(or_(*[Page.slug.like(p) for p in slug_patterns]))
    stats.pages = page_q.count()
    if write and stats.pages:
        page_q.delete(synchronize_session=False)

    tpl_q = db.query(PageTemplate).filter(or_(*[PageTemplate.slug.like(p) for p in slug_patterns]))
    stats.templates = tpl_q.count()
    if write and stats.templates:
        tpl_q.delete(synchronize_session=False)

    menu_q = db.query(Menu).filter(or_(*[Menu.slug.like(p) for p in slug_patterns]))
    menu_ids = [m.id for m in menu_q.all()]
    stats.menus = len(menu_ids)
    if menu_ids:
        mi_q = db.query(MenuItem).filter(MenuItem.menu_id.in_(menu_ids))
        stats.menu_items = mi_q.count()
        if write and stats.menu_items:
            mi_q.delete(synchronize_session=False)
    if write and stats.menus:
        db.query(Menu).filter(Menu.id.in_(menu_ids)).delete(synchronize_session=False)

    media_q = db.query(MediaAsset).filter(
        or_(
            MediaAsset.stored_name.like("seed/%"),
            MediaAsset.original_name.ilike("%demo%"),
            MediaAsset.original_name.ilike("%sample%"),
            MediaAsset.original_name.ilike("%starter%"),
        )
    )
    stats.media_assets = media_q.count()
    if write and stats.media_assets:
        media_q.delete(synchronize_session=False)

    folder_q = db.query(MediaFolder).filter(
        or_(
            MediaFolder.name.ilike("%demo%"),
            MediaFolder.name.ilike("%sample%"),
            MediaFolder.name.ilike("%starter%"),
            MediaFolder.name == "seed",
        )
    )
    stats.media_folders = folder_q.count()
    if write and stats.media_folders:
        folder_q.delete(synchronize_session=False)

    theme_q = db.query(Theme).filter(or_(*[Theme.slug.like(p) for p in slug_patterns]))
    stats.themes = theme_q.count()
    if write and stats.themes:
        theme_q.delete(synchronize_session=False)

    comp_q = db.query(Component).filter(or_(*[Component.slug.like(p) for p in slug_patterns]))
    stats.components = comp_q.count()
    if write and stats.components:
        comp_q.delete(synchronize_session=False)

    block_q = db.query(BlockTemplate).filter(or_(*[BlockTemplate.slug.like(p) for p in slug_patterns]))
    stats.blocks = block_q.count()
    if write and stats.blocks:
        block_q.delete(synchronize_session=False)

    if write:
        for key in ("appearance.active_theme", "reading.front_page_slug"):
            opt = db.query(Option).filter(Option.key == key).first()
            if opt and value_re.search(opt.value_json or ""):
                opt.value_json = '"default"' if key == "appearance.active_theme" else '"home"'
                stats.options_reset += 1

    return stats


def _all_content_cleanup(db, write: bool) -> CleanupStats:
    stats = CleanupStats()

    def count_and_delete(query, key: str):
        n = query.count()
        setattr(stats, key, n)
        if write and n:
            query.delete(synchronize_session=False)

    count_and_delete(db.query(TermRelationship), "term_relationships")
    count_and_delete(db.query(Term), "terms")
    count_and_delete(db.query(Taxonomy), "taxonomies")

    count_and_delete(db.query(ContentEntry), "content_entries")
    count_and_delete(db.query(ContentField), "content_fields")
    count_and_delete(db.query(ContentType), "content_types")

    count_and_delete(db.query(MenuItem), "menu_items")
    count_and_delete(db.query(Menu), "menus")

    count_and_delete(db.query(BlockTemplate), "blocks")
    count_and_delete(db.query(Component), "components")

    count_and_delete(db.query(Page), "pages")
    count_and_delete(db.query(PageTemplate), "templates")

    count_and_delete(db.query(MediaAsset), "media_assets")
    count_and_delete(db.query(MediaFolder), "media_folders")

    count_and_delete(db.query(Theme), "themes")

    option_count = db.query(Option).count()
    stats.options_reset = option_count
    if write and option_count:
        db.query(Option).delete(synchronize_session=False)

    return stats


def _print_stats(label: str, stats: CleanupStats):
    print(f"\n[{label}]")
    for key, value in stats.__dict__.items():
        if value:
            print(f"  {key:18s}: {value}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prune non-roadmap legacy artifacts from DB. Default mode is dry-run."
    )
    parser.add_argument(
        "--all-content",
        action="store_true",
        help="Delete all content records (pages/templates/menus/media/components/blocks/collections/themes/options) and re-seed minimal defaults.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Apply changes. Without this flag, script only reports counts.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        mode = "ALL_CONTENT" if args.all_content else "TARGETED"
        print(f"Prune mode: {mode} ({'WRITE' if args.write else 'DRY-RUN'})")

        stats = _all_content_cleanup(db, args.write) if args.all_content else _targeted_cleanup(db, args.write)

        if args.write:
            db.commit()
            if args.all_content:
                seed_defaults(db.get_bind(), SessionLocal)
        else:
            db.rollback()

        _print_stats(mode, stats)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
