from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from app.core.page_builder_validation import (
    CANONICAL_EDITOR_VERSION,
    validate_page_builder_document,
)
from app.db_session import SessionLocal
from app.models import BlockTemplate, Page, PageTemplate


COMPAT_UPGRADE_VERSIONS = {3, 4}
CANVAS_DEFAULT = {
    "snapPx": 1,
    "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
    "minHeightPx": 800,
}


@dataclass
class MigrationStats:
    scanned: int = 0
    migrated: int = 0
    already_canonical: int = 0
    unsupported_version: int = 0
    invalid_json: int = 0
    invalid_shape: int = 0
    validation_failed: int = 0


@dataclass
class NodeGeom:
    width_desktop: int
    width_tablet: int
    width_mobile: int


def _parse_json(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _safe_id(raw: Any, fallback: str) -> str:
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return fallback


def _default_heights(node_type: str) -> int:
    if node_type == "image":
        return 220
    if node_type in ("editor", "tiptap"):
        return 180
    if node_type == "button":
        return 56
    if node_type == "separator":
        return 24
    return 96


def _block_to_node(block: dict[str, Any], *, geom: NodeGeom, y: int, index: int) -> tuple[dict[str, Any], int]:
    raw_type = str(block.get("type") or "unknown").strip().lower()
    data = block.get("data") if isinstance(block.get("data"), dict) else {}

    if raw_type in ("text", "typography", "paragraph", "heading"):
        node_type = "typography"
    elif raw_type in ("tiptap", "editor"):
        node_type = "editor"
    elif raw_type in ("image", "button", "separator", "collection-list"):
        node_type = raw_type
    else:
        node_type = "unknown"

    h = _default_heights(node_type)
    node = {
        "id": _safe_id(block.get("id"), f"blk_{index}"),
        "type": node_type,
        "data": data,
        "frames": {
            "desktop": {"x": 0, "y": y, "w": geom.width_desktop, "h": h},
            "tablet": {"x": 0, "y": y, "w": geom.width_tablet, "h": h},
            "mobile": {"x": 0, "y": y, "w": geom.width_mobile, "h": h},
        },
    }

    return node, y + h + 12


def _upgrade_v3_to_v6(doc: dict[str, Any]) -> dict[str, Any]:
    layout = doc.get("layout") if isinstance(doc.get("layout"), dict) else {}
    rows = layout.get("rows") if isinstance(layout.get("rows"), list) else []

    widths = CANVAS_DEFAULT["widths"]
    out_nodes: list[dict[str, Any]] = []
    page_y_desktop = 0
    page_y_tablet = 0
    page_y_mobile = 0

    for row_index, row in enumerate(rows):
        if not isinstance(row, dict):
            continue

        cols = row.get("columns") if isinstance(row.get("columns"), list) else []
        if not cols:
            continue

        settings = row.get("settings") if isinstance(row.get("settings"), dict) else {}
        sizes = settings.get("sizes") if isinstance(settings.get("sizes"), list) else []

        normalized_sizes: list[float] = []
        for i, _ in enumerate(cols):
            raw = sizes[i] if i < len(sizes) else None
            if isinstance(raw, (int, float)) and raw > 0:
                normalized_sizes.append(float(raw))
            else:
                normalized_sizes.append(100.0 / max(1, len(cols)))

        size_sum = sum(normalized_sizes)
        if size_sum <= 0:
            normalized_sizes = [100.0 / max(1, len(cols)) for _ in cols]
            size_sum = 100.0

        normalized_sizes = [(v / size_sum) * 100.0 for v in normalized_sizes]

        row_children: list[dict[str, Any]] = []
        col_x_desktop = 0
        col_x_tablet = 0
        stack_y_mobile = 0
        row_h_desktop = 0
        row_h_tablet = 0

        for col_index, col in enumerate(cols):
            if not isinstance(col, dict):
                continue

            pct = normalized_sizes[col_index]
            col_w_desktop = max(80, int(round(widths["desktop"] * pct / 100.0)))
            col_w_tablet = max(80, int(round(widths["tablet"] * pct / 100.0)))
            col_w_mobile = widths["mobile"]

            geom = NodeGeom(
                width_desktop=col_w_desktop,
                width_tablet=col_w_tablet,
                width_mobile=col_w_mobile,
            )

            blocks = col.get("blocks") if isinstance(col.get("blocks"), list) else []
            block_nodes: list[dict[str, Any]] = []
            block_y = 0
            for blk_index, blk in enumerate(blocks):
                if not isinstance(blk, dict):
                    continue
                node, block_y = _block_to_node(blk, geom=geom, y=block_y, index=blk_index)
                block_nodes.append(node)

            col_h = max(160, block_y if block_nodes else 160)
            row_h_desktop = max(row_h_desktop, col_h)
            row_h_tablet = max(row_h_tablet, col_h)

            col_node = {
                "id": _safe_id(col.get("id"), f"col_{row_index}_{col_index}"),
                "type": "frame",
                "data": {"layout": "box", "label": f"Column {col_index + 1}"},
                "frames": {
                    "desktop": {"x": col_x_desktop, "y": 0, "w": col_w_desktop, "h": col_h},
                    "tablet": {"x": col_x_tablet, "y": 0, "w": col_w_tablet, "h": col_h},
                    "mobile": {"x": 0, "y": stack_y_mobile, "w": col_w_mobile, "h": col_h},
                },
                "nodes": block_nodes,
            }
            row_children.append(col_node)

            col_x_desktop += col_w_desktop
            col_x_tablet += col_w_tablet
            stack_y_mobile += col_h + 12

        row_h_mobile = max(160, stack_y_mobile - 12 if stack_y_mobile > 0 else 160)

        row_node = {
            "id": _safe_id(row.get("id"), f"row_{row_index}"),
            "type": "frame",
            "data": {"layout": "flex", "label": f"Row {row_index + 1}"},
            "frames": {
                "desktop": {
                    "x": 0,
                    "y": page_y_desktop,
                    "w": widths["desktop"],
                    "h": max(160, row_h_desktop),
                },
                "tablet": {
                    "x": 0,
                    "y": page_y_tablet,
                    "w": widths["tablet"],
                    "h": max(160, row_h_tablet),
                },
                "mobile": {
                    "x": 0,
                    "y": page_y_mobile,
                    "w": widths["mobile"],
                    "h": row_h_mobile,
                },
            },
            "nodes": row_children,
        }

        out_nodes.append(row_node)

        page_y_desktop += max(160, row_h_desktop) + 24
        page_y_tablet += max(160, row_h_tablet) + 24
        page_y_mobile += row_h_mobile + 24

    return {
        "version": CANONICAL_EDITOR_VERSION,
        "canvas": CANVAS_DEFAULT,
        "layout": {"nodes": out_nodes},
    }


def _migrate_document(doc: dict[str, Any], *, context: str) -> tuple[dict[str, Any] | None, str | None]:
    version = doc.get("version")

    if version == CANONICAL_EDITOR_VERSION:
        return doc, None

    if version not in COMPAT_UPGRADE_VERSIONS:
        return None, f"unsupported version: {version!r}"

    if version == 4:
        candidate = dict(doc)
        candidate["version"] = CANONICAL_EDITOR_VERSION
    else:
        candidate = _upgrade_v3_to_v6(doc)

    try:
        validated = validate_page_builder_document(candidate, context=context)
    except ValueError as exc:
        return None, str(exc)

    return validated, None


def _run_table(
    db,
    *,
    model,
    field_name: str,
    context_prefix: str,
    write: bool,
) -> tuple[MigrationStats, list[str]]:
    stats = MigrationStats()
    failures: list[str] = []

    rows = db.query(model).all()
    for row in rows:
        stats.scanned += 1
        raw = getattr(row, field_name, None)
        parsed = _parse_json(raw)

        row_label = f"{context_prefix}[id={getattr(row, 'id', '?')}]"

        if parsed is None:
            stats.invalid_json += 1
            failures.append(f"{row_label}: invalid JSON")
            continue

        if not isinstance(parsed, dict):
            stats.invalid_shape += 1
            failures.append(f"{row_label}: root must be object")
            continue

        version = parsed.get("version")
        if version == CANONICAL_EDITOR_VERSION:
            stats.already_canonical += 1
            continue

        migrated, error = _migrate_document(parsed, context=row_label)
        if migrated is None:
            if isinstance(error, str) and error.startswith("unsupported version"):
                stats.unsupported_version += 1
            else:
                stats.validation_failed += 1
            failures.append(f"{row_label}: {error or 'unknown migration error'}")
            continue

        stats.migrated += 1
        if write:
            setattr(row, field_name, json.dumps(migrated, ensure_ascii=False))

    return stats, failures


def _print_stats(name: str, stats: MigrationStats) -> None:
    print(f"\n[{name}]")
    print(f"  scanned            : {stats.scanned}")
    print(f"  migrated           : {stats.migrated}")
    print(f"  already_canonical  : {stats.already_canonical}")
    print(f"  unsupported_version: {stats.unsupported_version}")
    print(f"  invalid_json       : {stats.invalid_json}")
    print(f"  invalid_shape      : {stats.invalid_shape}")
    print(f"  validation_failed  : {stats.validation_failed}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Migrate editor documents to canonical V6 for pages/templates/blocks. "
            "Defaults to dry-run. Pass --write to persist changes."
        )
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Persist migrated documents to DB (default is dry-run).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    all_failures: list[str] = []

    try:
        pages_stats, pages_failures = _run_table(
            db,
            model=Page,
            field_name="blocks_json",
            context_prefix="page.blocks",
            write=args.write,
        )
        templates_stats, templates_failures = _run_table(
            db,
            model=PageTemplate,
            field_name="definition_json",
            context_prefix="template.definition",
            write=args.write,
        )
        blocks_stats, blocks_failures = _run_table(
            db,
            model=BlockTemplate,
            field_name="definition_json",
            context_prefix="block.definition",
            write=args.write,
        )

        all_failures.extend(pages_failures)
        all_failures.extend(templates_failures)
        all_failures.extend(blocks_failures)

        if args.write:
            db.commit()
        else:
            db.rollback()

        mode = "WRITE" if args.write else "DRY-RUN"
        print(f"\nEditor V6 migration summary ({mode})")
        _print_stats("pages", pages_stats)
        _print_stats("templates", templates_stats)
        _print_stats("blocks", blocks_stats)

        if all_failures:
            print("\nFailures:")
            for failure in all_failures:
                print(f"  - {failure}")

        return 1 if all_failures else 0

    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
