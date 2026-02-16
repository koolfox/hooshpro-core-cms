from __future__ import annotations

import json
import math
from collections.abc import Mapping
from typing import Any

_BREAKPOINTS = ("mobile", "tablet", "desktop")
_ALLOWED_VERSIONS = {1, 3, 4}
_ALLOWED_NODE_TYPES = {
    "frame",
    "slot",
    "menu",
    "editor",
    "collection-list",
    "button",
    "separator",
    "typography",
    "image",
    "shape",
    "shadcn",
}
_MAX_NODES = 2000
_MAX_DEPTH = 32
_MAX_ID_LENGTH = 120
_MAX_COORD = 1_000_000


def _as_dict(value: Any, path: str) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    raise ValueError(f"{path} must be an object.")


def _as_list(value: Any, path: str) -> list[Any]:
    if isinstance(value, list):
        return value
    raise ValueError(f"{path} must be an array.")


def _as_number(value: Any, path: str) -> float:
    if not isinstance(value, (int, float)):
        raise ValueError(f"{path} must be a number.")
    n = float(value)
    if not math.isfinite(n):
        raise ValueError(f"{path} must be finite.")
    return n


def _validate_frame(frame: Mapping[str, Any], path: str) -> None:
    x = _as_number(frame.get("x"), f"{path}.x")
    y = _as_number(frame.get("y"), f"{path}.y")
    w = _as_number(frame.get("w"), f"{path}.w")
    h = _as_number(frame.get("h"), f"{path}.h")

    if abs(x) > _MAX_COORD or abs(y) > _MAX_COORD:
        raise ValueError(f"{path}.x/.y are out of bounds.")
    if w <= 0 or h <= 0:
        raise ValueError(f"{path}.w/.h must be > 0.")
    if w > _MAX_COORD or h > _MAX_COORD:
        raise ValueError(f"{path}.w/.h are too large.")

    if "z" in frame:
        _as_number(frame.get("z"), f"{path}.z")


def validate_page_builder_document(
    document: Any,
    *,
    context: str = "document",
) -> dict[str, Any]:
    """Validate persisted page-builder JSON document.

    Supports v1/v3/v4 payloads for backward compatibility,
    and enforces strict graph checks for v4.
    """

    root = _as_dict(document, context)

    version = root.get("version")
    if not isinstance(version, int):
        raise ValueError(f"{context}.version must be an integer.")
    if version not in _ALLOWED_VERSIONS:
        raise ValueError(f"{context}.version must be one of {sorted(_ALLOWED_VERSIONS)}.")

    if version == 1:
        _as_list(root.get("blocks"), f"{context}.blocks")
        return dict(root)

    if version == 3:
        layout = _as_dict(root.get("layout"), f"{context}.layout")
        _as_list(layout.get("rows"), f"{context}.layout.rows")
        return dict(root)

    # v4 strict validation
    canvas = _as_dict(root.get("canvas"), f"{context}.canvas")
    snap_px = _as_number(canvas.get("snapPx"), f"{context}.canvas.snapPx")
    if snap_px <= 0 or snap_px > 128:
        raise ValueError(f"{context}.canvas.snapPx must be between 1 and 128.")

    widths = _as_dict(canvas.get("widths"), f"{context}.canvas.widths")
    for bp in _BREAKPOINTS:
        w = _as_number(widths.get(bp), f"{context}.canvas.widths.{bp}")
        if w < 240 or w > _MAX_COORD:
            raise ValueError(f"{context}.canvas.widths.{bp} must be between 240 and {_MAX_COORD}.")

    min_height = _as_number(canvas.get("minHeightPx"), f"{context}.canvas.minHeightPx")
    if min_height < 240 or min_height > _MAX_COORD:
        raise ValueError(f"{context}.canvas.minHeightPx must be between 240 and {_MAX_COORD}.")

    layout = _as_dict(root.get("layout"), f"{context}.layout")
    nodes = _as_list(layout.get("nodes"), f"{context}.layout.nodes")

    seen_ids: set[str] = set()
    node_count = 0

    def walk(items: list[Any], depth: int, path: str) -> None:
        nonlocal node_count
        if depth > _MAX_DEPTH:
            raise ValueError(f"{path} exceeds max depth {_MAX_DEPTH}.")

        for idx, raw_node in enumerate(items):
            node_path = f"{path}[{idx}]"
            node = _as_dict(raw_node, node_path)

            node_id_raw = node.get("id")
            if not isinstance(node_id_raw, str) or not node_id_raw.strip():
                raise ValueError(f"{node_path}.id must be a non-empty string.")
            node_id = node_id_raw.strip()
            if len(node_id) > _MAX_ID_LENGTH:
                raise ValueError(f"{node_path}.id exceeds max length {_MAX_ID_LENGTH}.")
            if node_id in seen_ids:
                raise ValueError(f"Duplicate node id '{node_id}' in {context}.")
            seen_ids.add(node_id)

            node_type = node.get("type")
            if not isinstance(node_type, str) or node_type not in _ALLOWED_NODE_TYPES:
                raise ValueError(f"{node_path}.type must be one of {sorted(_ALLOWED_NODE_TYPES)}.")

            _as_dict(node.get("data"), f"{node_path}.data")

            frames = _as_dict(node.get("frames"), f"{node_path}.frames")
            for bp in _BREAKPOINTS:
                frame = _as_dict(frames.get(bp), f"{node_path}.frames.{bp}")
                _validate_frame(frame, f"{node_path}.frames.{bp}")

            if "meta" in node:
                _as_dict(node.get("meta"), f"{node_path}.meta")

            children_raw = node.get("nodes", [])
            children = _as_list(children_raw, f"{node_path}.nodes")

            node_count += 1
            if node_count > _MAX_NODES:
                raise ValueError(f"{context} exceeds max node count {_MAX_NODES}.")

            if children:
                walk(children, depth + 1, f"{node_path}.nodes")

    walk(nodes, 0, f"{context}.layout.nodes")

    # Ensure the payload can be persisted as JSON text.
    try:
        json.dumps(root)
    except Exception as exc:  # pragma: no cover
        raise ValueError(f"{context} must be JSON-serializable.") from exc

    return dict(root)
