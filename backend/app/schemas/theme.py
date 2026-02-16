from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.page import validate_slug

CSS_VAR_KEY_RE = re.compile(r"^--[a-z0-9-]+$")


def normalize_css_vars(vars_obj: dict[str, str] | None) -> dict[str, str]:
    if not vars_obj:
        return {}

    out: dict[str, str] = {}
    for raw_k, raw_v in vars_obj.items():
        k = (raw_k or "").strip()
        if not CSS_VAR_KEY_RE.match(k):
            raise ValueError(f"Invalid CSS variable key '{raw_k}'. Use format like '--primary'.")
        if not isinstance(raw_v, str):
            raise ValueError(f"CSS variable '{k}' must be a string value.")
        v = raw_v.strip()
        if not v:
            raise ValueError(f"CSS variable '{k}' cannot be empty.")
        out[k] = v
    return out


def safe_load_vars(value_json: str | None) -> dict[str, str]:
    if not value_json:
        return {}
    try:
        raw = json.loads(value_json)
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in raw.items():
        if isinstance(k, str) and isinstance(v, str):
            out[k] = v
    return out


class ThemeCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    vars: dict[str, str] = Field(default_factory=dict)

    def normalized(self) -> "ThemeCreate":
        self.slug = validate_slug(self.slug)
        self.title = self.title.strip()[:200] or self.slug
        if self.description is not None:
            self.description = self.description.strip()[:500] or None
        self.vars = normalize_css_vars(self.vars)
        return self


class ThemeUpdate(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=200)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    vars: Optional[dict[str, str]] = None

    def normalized(self) -> "ThemeUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.title is not None:
            self.title = self.title.strip()[:200] or None
        if self.description is not None:
            self.description = self.description.strip()[:500] or None
        if self.vars is not None:
            self.vars = normalize_css_vars(self.vars)
        return self


class ThemeOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    vars: dict[str, str] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ThemeListOut(BaseModel):
    items: list[ThemeOut]
    total: int
    limit: int
    offset: int


class PublicThemeOut(BaseModel):
    slug: str
    title: str
    vars: dict[str, str] = Field(default_factory=dict)

