from __future__ import annotations

import re
from typing import Any, Optional
from datetime import datetime

from pydantic import BaseModel, Field

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_block_slug(slug: str) -> str:
    s = slug.strip().lower()
    if not SLUG_RE.match(s):
        raise ValueError("Slug must be lowercase letters/numbers with hyphens (e.g. hero-section)")
    return s


class BlockCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    definition: dict[str, Any] = Field(
        default_factory=lambda: {"version": 3, "layout": {"rows": []}}
    )

    def normalized(self) -> "BlockCreate":
        self.slug = validate_block_slug(self.slug)
        return self


class BlockUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    definition: Optional[dict[str, Any]] = None

    def normalized(self) -> "BlockUpdate":
        if self.slug is not None:
            self.slug = validate_block_slug(self.slug)
        return self


class BlockOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    definition: dict[str, Any] = Field(
        default_factory=lambda: {"version": 3, "layout": {"rows": []}}
    )
    created_at: datetime
    updated_at: datetime


class BlockListOut(BaseModel):
    items: list[BlockOut]
    total: int
    limit: int
    offset: int

