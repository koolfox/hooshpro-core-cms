from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.core.page_builder_validation import CANONICAL_EDITOR_VERSION

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RESERVED_SLUGS = {
    "admin",
    "login",
    "logout",
    "media",
    "api",
    "auth",
}


def validate_slug(slug: str) -> str:
    s = slug.strip().lower()
    if s in RESERVED_SLUGS:
        raise ValueError(f"Slug '{s}' is reserved.")
    if not SLUG_RE.match(s):
        raise ValueError("Slug must be lowercase letters/numbers with hyphens (e.g. about-us123)")
    return s


class PageCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    status: str = Field(default="draft")
    seo_title: Optional[str] = Field(default=None, max_length=200)
    seo_description: Optional[str] = Field(default=None, max_length=500)

    # Deprecated in V6: body-only writes are no longer accepted.
    body: Optional[str] = None

    blocks: Optional[dict[str, Any]] = None

    def normalized(self) -> "PageCreate":
        self.slug = validate_slug(self.slug)
        if self.status not in ("draft", "published"):
            raise ValueError("status must be draft|published")
        return self


class PageUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = None
    seo_title: Optional[str] = Field(default=None, max_length=200)
    seo_description: Optional[str] = Field(default=None, max_length=500)

    # Deprecated in V6: body-only writes are no longer accepted.
    body: Optional[str] = None

    blocks: Optional[dict[str, Any]] = None

    def normalized(self) -> "PageUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.status is not None and self.status not in ("draft", "published"):
            raise ValueError("status must be draft|published")
        return self


class PageOut(BaseModel):
    id: int
    title: str
    slug: str
    status: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None

    body: str = ""
    blocks: dict[str, Any] = Field(
        default_factory=lambda: {
            "version": CANONICAL_EDITOR_VERSION,
            "canvas": {
                "snapPx": 1,
                "widths": {"mobile": 390, "tablet": 820, "desktop": 1200},
                "minHeightPx": 800,
            },
            "layout": {"nodes": []},
        }
    )

    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PageListOut(BaseModel):
    items: list[PageOut]
    total: int
    limit: int
    offset: int
