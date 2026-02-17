from __future__ import annotations

import json
import math
from collections.abc import Mapping
from typing import Any

BREAKPOINTS = ("mobile", "tablet", "desktop")
CANONICAL_EDITOR_VERSION = 6
COMPAT_EDITOR_VERSIONS = {4, CANONICAL_EDITOR_VERSION}
ALLOWED_NODE_TYPES = {
    "frame",
    "slot",
    "menu",
    "editor",
    "tiptap",
    "collection-list",
    "button",
    "separator",
    "typography",
    "text",
    "image",
    "shape",
    "card",
    "shadcn",
    "unknown",
}
CONTAINER_NODE_TYPES = {"frame", "shape"}
MAX_NODES = 2000
MAX_DEPTH = 32
MAX_ID_LENGTH = 120
MAX_COORD = 1_000_000


class PageBuilderValidationError(ValueError):
    """Raised when a persisted editor document is invalid."""


def _as_dict(value: Any, path: str) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    raise PageBuilderValidationError(f"{path} must be an object.")


def _as_list(value: Any, path: str) -> list[Any]:
    if isinstance(value, list):
        return value
    raise PageBuilderValidationError(f"{path} must be an array.")


def _as_number(value: Any, path: str) -> float:
    if not isinstance(value, (int, float)):
        raise PageBuilderValidationError(f"{path} must be a number.")
    n = float(value)
    if not math.isfinite(n):
        raise PageBuilderValidationError(f"{path} must be finite.")
    return n


def _validate_frame(frame: Mapping[str, Any], path: str) -> None:
    x = _as_number(frame.get("x"), f"{path}.x")
    y = _as_number(frame.get("y"), f"{path}.y")
    w = _as_number(frame.get("w"), f"{path}.w")
    h = _as_number(frame.get("h"), f"{path}.h")

    if abs(x) > MAX_COORD or abs(y) > MAX_COORD:
        raise PageBuilderValidationError(f"{path}.x/.y are out of bounds.")
    if w <= 0 or h <= 0:
        raise PageBuilderValidationError(f"{path}.w/.h must be > 0.")
    if w > MAX_COORD or h > MAX_COORD:
        raise PageBuilderValidationError(f"{path}.w/.h are too large.")

    if "z" in frame:
        _as_number(frame.get("z"), f"{path}.z")


def validate_page_builder_document(
    document: Any,
    *,
    context: str = "document",
) -> dict[str, Any]:
    """Validate persisted page-builder JSON document (V4/V6 graph only)."""

    root = _as_dict(document, context)

    version = root.get("version")
    if not isinstance(version, int):
        raise PageBuilderValidationError(f"{context}.version must be an integer.")
    if version not in COMPAT_EDITOR_VERSIONS:
        expected = sorted(COMPAT_EDITOR_VERSIONS)
        raise PageBuilderValidationError(
            f"{context}.version must be one of {expected}."
        )

    canvas = _as_dict(root.get("canvas"), f"{context}.canvas")
    snap_px = _as_number(canvas.get("snapPx"), f"{context}.canvas.snapPx")
    if snap_px <= 0 or snap_px > 128:
        raise PageBuilderValidationError(
            f"{context}.canvas.snapPx must be between 1 and 128."
        )

    widths = _as_dict(canvas.get("widths"), f"{context}.canvas.widths")
    for bp in BREAKPOINTS:
        w = _as_number(widths.get(bp), f"{context}.canvas.widths.{bp}")
        if w < 240 or w > MAX_COORD:
            raise PageBuilderValidationError(
                f"{context}.canvas.widths.{bp} must be between 240 and {MAX_COORD}."
            )

    min_height = _as_number(canvas.get("minHeightPx"), f"{context}.canvas.minHeightPx")
    if min_height < 240 or min_height > MAX_COORD:
        raise PageBuilderValidationError(
            f"{context}.canvas.minHeightPx must be between 240 and {MAX_COORD}."
        )

    layout = _as_dict(root.get("layout"), f"{context}.layout")
    nodes = _as_list(layout.get("nodes"), f"{context}.layout.nodes")

    seen_ids: set[str] = set()
    node_count = 0

    def walk(items: list[Any], depth: int, path: str) -> None:
        nonlocal node_count
        if depth > MAX_DEPTH:
            raise PageBuilderValidationError(f"{path} exceeds max depth {MAX_DEPTH}.")

        for idx, raw_node in enumerate(items):
            node_path = f"{path}[{idx}]"
            node = _as_dict(raw_node, node_path)

            node_id_raw = node.get("id")
            if not isinstance(node_id_raw, str) or not node_id_raw.strip():
                raise PageBuilderValidationError(
                    f"{node_path}.id must be a non-empty string."
                )
            node_id = node_id_raw.strip()
            if len(node_id) > MAX_ID_LENGTH:
                raise PageBuilderValidationError(
                    f"{node_path}.id exceeds max length {MAX_ID_LENGTH}."
                )
            if node_id in seen_ids:
                raise PageBuilderValidationError(
                    f"Duplicate node id '{node_id}' in {context}."
                )
            seen_ids.add(node_id)

            node_type = node.get("type")
            if not isinstance(node_type, str) or node_type not in ALLOWED_NODE_TYPES:
                allowed = sorted(ALLOWED_NODE_TYPES)
                raise PageBuilderValidationError(
                    f"{node_path}.type must be one of {allowed}."
                )

            _as_dict(node.get("data"), f"{node_path}.data")

            frames = _as_dict(node.get("frames"), f"{node_path}.frames")
            for bp in BREAKPOINTS:
                frame = _as_dict(frames.get(bp), f"{node_path}.frames.{bp}")
                _validate_frame(frame, f"{node_path}.frames.{bp}")

            if "meta" in node:
                _as_dict(node.get("meta"), f"{node_path}.meta")

            if "children" in node:
                _as_list(node.get("children"), f"{node_path}.children")

            if "nodes" in node:
                children = _as_list(node.get("nodes"), f"{node_path}.nodes")
                if node_type not in CONTAINER_NODE_TYPES:
                    allowed = sorted(CONTAINER_NODE_TYPES)
                    raise PageBuilderValidationError(
                        f"{node_path}.nodes is only allowed for {allowed}."
                    )
            else:
                children = []

            node_count += 1
            if node_count > MAX_NODES:
                raise PageBuilderValidationError(
                    f"{context} exceeds max node count {MAX_NODES}."
                )

            if children:
                walk(children, depth + 1, f"{node_path}.nodes")

    walk(nodes, 0, f"{context}.layout.nodes")

    try:
        json.dumps(root)
    except Exception as exc:  # pragma: no cover
        raise PageBuilderValidationError(
            f"{context} must be JSON-serializable."
        ) from exc

    return dict(root)
