from __future__ import annotations

import json
import math
import re
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
    "flow-form",
    "card",
    "shadcn",
    "unknown",
}
CONTAINER_NODE_TYPES = {"frame", "shape"}
MAX_NODES = 2000
MAX_DEPTH = 32
MAX_ID_LENGTH = 120
MAX_COORD = 1_000_000
MAX_STYLE_ITEMS = 200
MAX_STYLE_VALUE_LEN = 240

STYLE_TOP_LEVEL_KEYS = {"base", "breakpoints", "states", "stateBreakpoints", "advanced"}
STYLE_BREAKPOINT_KEYS = {"mobile", "tablet"}
STYLE_STATE_KEYS = {"hover", "active", "focus"}
STYLE_KEY_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9-]*$")
STYLE_VALUE_DENY_PATTERNS = (
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"expression\s*\(", re.IGNORECASE),
    re.compile(r"@import\b", re.IGNORECASE),
    re.compile(r"</?script\b", re.IGNORECASE),
    re.compile(r"url\s*\(\s*['\"]?\s*javascript\s*:", re.IGNORECASE),
)

CSS_NUMBER_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
CSS_INTEGER_RE = re.compile(r"^-?\d+$")
CSS_LENGTH_OR_ZERO_RE = re.compile(r"^(?:0|-?\d+(?:\.\d+)?(?:px|%|rem|vw|vh))$", re.IGNORECASE)
CSS_SIZE_RE = re.compile(r"^(?:auto|fit-content|min-content|max-content|none|0|-?\d+(?:\.\d+)?(?:px|%|rem|vw|vh))$", re.IGNORECASE)
CSS_COLOR_RE = re.compile(
    r"^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|oklab)\([^)]*\)|transparent|currentcolor|inherit|var\(--[a-z0-9-_]+\))$",
    re.IGNORECASE,
)
CSS_TIMING_RE = re.compile(
    r"^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([^)]*\)|steps\([^)]*\))$",
    re.IGNORECASE,
)
CSS_SIMPLE_TOKEN_RE = re.compile(r"^[a-z0-9_#().,%\-+\s/]*$", re.IGNORECASE)

NODE_STYLE_ALLOWED_KEYS = {
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "zIndex",
    "display",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "minHeight",
    "maxHeight",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "gap",
    "rowGap",
    "columnGap",
    "flexDirection",
    "flexWrap",
    "justifyContent",
    "alignItems",
    "alignContent",
    "gridTemplateColumns",
    "gridTemplateRows",
    "gridAutoFlow",
    "placeItems",
    "placeContent",
    "background",
    "backgroundColor",
    "backgroundImage",
    "backgroundPosition",
    "backgroundSize",
    "backgroundRepeat",
    "border",
    "borderWidth",
    "borderStyle",
    "borderColor",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "borderRadius",
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
    "boxShadow",
    "opacity",
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "textTransform",
    "textDecoration",
    "visibility",
    "whiteSpace",
    "wordBreak",
    "objectFit",
    "objectPosition",
    "overflow",
    "overflowX",
    "overflowY",
    "transform",
    "transformOrigin",
    "filter",
    "backdropFilter",
    "transition",
    "transitionProperty",
    "transitionDuration",
    "transitionTimingFunction",
    "transitionDelay",
    "mixBlendMode",
    "cursor",
    "pointerEvents",
    "userSelect",
}

STYLE_ENUMS: dict[str, set[str]] = {
    "position": {"static", "relative", "absolute", "fixed", "sticky"},
    "display": {
        "block",
        "inline",
        "inline-block",
        "flex",
        "inline-flex",
        "grid",
        "inline-grid",
        "none",
        "contents",
    },
    "flexDirection": {"row", "row-reverse", "column", "column-reverse"},
    "flexWrap": {"nowrap", "wrap", "wrap-reverse"},
    "justifyContent": {
        "normal",
        "start",
        "end",
        "center",
        "left",
        "right",
        "flex-start",
        "flex-end",
        "space-between",
        "space-around",
        "space-evenly",
        "stretch",
    },
    "alignItems": {"normal", "start", "end", "center", "baseline", "stretch", "flex-start", "flex-end"},
    "alignContent": {
        "normal",
        "start",
        "end",
        "center",
        "stretch",
        "space-between",
        "space-around",
        "space-evenly",
        "flex-start",
        "flex-end",
    },
    "gridAutoFlow": {"row", "column", "dense", "row dense", "column dense"},
    "textAlign": {"left", "right", "center", "justify", "start", "end", "match-parent"},
    "textTransform": {"none", "capitalize", "uppercase", "lowercase", "full-width", "full-size-kana"},
    "textDecoration": {"none", "underline", "overline", "line-through"},
    "visibility": {"visible", "hidden", "collapse"},
    "whiteSpace": {"normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"},
    "wordBreak": {"normal", "break-all", "keep-all", "break-word"},
    "objectFit": {"fill", "contain", "cover", "none", "scale-down"},
    "overflow": {"visible", "hidden", "clip", "scroll", "auto"},
    "overflowX": {"visible", "hidden", "clip", "scroll", "auto"},
    "overflowY": {"visible", "hidden", "clip", "scroll", "auto"},
    "pointerEvents": {"auto", "none"},
    "userSelect": {"auto", "none", "text", "contain", "all"},
    "cursor": {
        "auto",
        "default",
        "pointer",
        "grab",
        "grabbing",
        "text",
        "move",
        "not-allowed",
        "crosshair",
        "zoom-in",
        "zoom-out",
    },
    "borderStyle": {"none", "hidden", "dotted", "dashed", "solid", "double", "groove", "ridge", "inset", "outset"},
}


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


def _as_style_value(value: Any, path: str) -> str:
    if isinstance(value, str):
        out = value.strip()
    elif isinstance(value, (int, float)):
        n = float(value)
        if not math.isfinite(n):
            raise PageBuilderValidationError(f"{path} must be finite.")
        out = str(value)
    else:
        raise PageBuilderValidationError(f"{path} must be a string or number.")

    if not out:
        raise PageBuilderValidationError(f"{path} must not be empty.")
    if len(out) > MAX_STYLE_VALUE_LEN:
        raise PageBuilderValidationError(
            f"{path} exceeds max length {MAX_STYLE_VALUE_LEN}."
        )
    for pat in STYLE_VALUE_DENY_PATTERNS:
        if pat.search(out):
            raise PageBuilderValidationError(f"{path} contains an unsafe value.")
    return out


def _is_valid_style_value_for_key(key: str, value: str) -> bool:
    v = value.strip()
    if not v:
        return False

    enum_values = STYLE_ENUMS.get(key)
    if enum_values is not None:
        return v.lower() in enum_values

    if key == "opacity":
        if not CSS_NUMBER_RE.match(v):
            return False
        n = float(v)
        return 0 <= n <= 1

    if key == "zIndex":
        return bool(CSS_INTEGER_RE.match(v))

    if key in {
        "width",
        "height",
        "minWidth",
        "maxWidth",
        "minHeight",
        "maxHeight",
        "top",
        "right",
        "bottom",
        "left",
    }:
        return bool(CSS_SIZE_RE.match(v))

    if key in {
        "margin",
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "padding",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "gap",
        "rowGap",
        "columnGap",
        "borderWidth",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderRadius",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
        "fontSize",
        "lineHeight",
        "letterSpacing",
        "transitionDuration",
        "transitionDelay",
    }:
        return all(CSS_LENGTH_OR_ZERO_RE.match(part) for part in v.split())

    if key in {
        "color",
        "backgroundColor",
        "borderColor",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
    }:
        return bool(CSS_COLOR_RE.match(v))

    if key == "fontWeight":
        return bool(CSS_INTEGER_RE.match(v)) or v.lower() in {
            "normal",
            "bold",
            "lighter",
            "bolder",
        }

    if key in {"backgroundPosition", "objectPosition", "transformOrigin"}:
        return len(v) <= 80 and bool(CSS_SIMPLE_TOKEN_RE.match(v))

    if key == "transitionTimingFunction":
        return bool(CSS_TIMING_RE.match(v))

    # Composite CSS values remain permissive and are protected by deny patterns.
    return True


def _validate_style_map(raw: Any, path: str, *, allow_custom_keys: bool) -> None:
    style_map = _as_dict(raw, path)
    if len(style_map) > MAX_STYLE_ITEMS:
        raise PageBuilderValidationError(
            f"{path} exceeds max style items {MAX_STYLE_ITEMS}."
        )

    for key_raw, value_raw in style_map.items():
        if not isinstance(key_raw, str) or not key_raw.strip():
            raise PageBuilderValidationError(f"{path} has an invalid style key.")

        key = key_raw.strip()
        if allow_custom_keys:
            if not STYLE_KEY_RE.match(key):
                raise PageBuilderValidationError(
                    f"{path}.{key} is not a valid CSS property key."
                )
        elif key not in NODE_STYLE_ALLOWED_KEYS:
            raise PageBuilderValidationError(
                f"{path}.{key} is not an allowed style property."
            )

        out = _as_style_value(value_raw, f"{path}.{key}")
        if not allow_custom_keys and not _is_valid_style_value_for_key(key, out):
            raise PageBuilderValidationError(
                f"{path}.{key} has an invalid value '{out}'."
            )


def _validate_node_style(raw: Any, path: str) -> None:
    style = _as_dict(raw, path)

    for top_key in style.keys():
        if top_key not in STYLE_TOP_LEVEL_KEYS:
            raise PageBuilderValidationError(
                f"{path}.{top_key} is not a supported style section."
            )

    if "base" in style:
        _validate_style_map(style.get("base"), f"{path}.base", allow_custom_keys=False)

    if "breakpoints" in style:
        bp = _as_dict(style.get("breakpoints"), f"{path}.breakpoints")
        for bp_key, bp_map in bp.items():
            if bp_key not in STYLE_BREAKPOINT_KEYS:
                raise PageBuilderValidationError(
                    f"{path}.breakpoints.{bp_key} is not supported."
                )
            _validate_style_map(
                bp_map, f"{path}.breakpoints.{bp_key}", allow_custom_keys=False
            )

    if "states" in style:
        states = _as_dict(style.get("states"), f"{path}.states")
        for state_key, state_map in states.items():
            if state_key not in STYLE_STATE_KEYS:
                raise PageBuilderValidationError(
                    f"{path}.states.{state_key} is not supported."
                )
            _validate_style_map(
                state_map, f"{path}.states.{state_key}", allow_custom_keys=False
            )

    if "stateBreakpoints" in style:
        sb = _as_dict(style.get("stateBreakpoints"), f"{path}.stateBreakpoints")
        for state_key, state_bp_raw in sb.items():
            if state_key not in STYLE_STATE_KEYS:
                raise PageBuilderValidationError(
                    f"{path}.stateBreakpoints.{state_key} is not supported."
                )

            state_bp = _as_dict(state_bp_raw, f"{path}.stateBreakpoints.{state_key}")
            for bp_key, bp_map in state_bp.items():
                if bp_key not in STYLE_BREAKPOINT_KEYS:
                    raise PageBuilderValidationError(
                        f"{path}.stateBreakpoints.{state_key}.{bp_key} is not supported."
                    )
                _validate_style_map(
                    bp_map,
                    f"{path}.stateBreakpoints.{state_key}.{bp_key}",
                    allow_custom_keys=False,
                )

    if "advanced" in style:
        _validate_style_map(
            style.get("advanced"), f"{path}.advanced", allow_custom_keys=True
        )


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

            if "style" in node:
                _validate_node_style(node.get("style"), f"{node_path}.style")

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



