from __future__ import annotations

import re
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, Field

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RESERVED_SLUGS = {
    "admin",
    "login",
    "logout",
    "media",
    "api",
    "auth",
}


def validate_template_slug(slug: str) -> str:
    s = slug.strip().lower()
    if s in RESERVED_SLUGS:
        raise ValueError(f"Slug '{s}' is reserved.")
    if not SLUG_RE.match(s):
        raise ValueError("Slug must be lowercase letters/numbers with hyphens (e.g. landing-default)")
    return s


class TemplateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    menu: str = Field(default="main", min_length=1, max_length=60)
    footer: str = Field(default="none", min_length=1, max_length=60)

    def normalized(self) -> "TemplateCreate":
        self.slug = validate_template_slug(self.slug)
        self.menu = (self.menu or "main").strip()[:60] or "main"
        self.footer = (self.footer or "none").strip()[:60] or "none"
        return self


class TemplateUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    menu: Optional[str] = Field(default=None, max_length=60)
    footer: Optional[str] = Field(default=None, max_length=60)

    def normalized(self) -> "TemplateUpdate":
        if self.slug is not None:
            self.slug = validate_template_slug(self.slug)
        if self.menu is not None:
            self.menu = (self.menu or "main").strip()[:60] or "main"
        if self.footer is not None:
            self.footer = (self.footer or "none").strip()[:60] or "none"
        return self


class TemplateOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    menu: str
    footer: str
    created_at: datetime
    updated_at: datetime


class TemplateListOut(BaseModel):
    items: list[TemplateOut]
    total: int
    limit: int
    offset: int
