from __future__ import annotations

import re
from typing import Any, Optional
from datetime import datetime

from pydantic import BaseModel, Field

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_component_slug(slug: str) -> str:
    s = slug.strip().lower()
    if not SLUG_RE.match(s):
        raise ValueError("Slug must be lowercase letters/numbers with hyphens (e.g. hero-banner)")
    return s


class ComponentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=60)
    description: Optional[str] = Field(default=None, max_length=500)
    data: dict[str, Any] = Field(default_factory=dict)

    def normalized(self) -> "ComponentCreate":
        self.slug = validate_component_slug(self.slug)
        self.type = self.type.strip()
        if not self.type:
            raise ValueError("type is required")
        return self


class ComponentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    type: Optional[str] = Field(default=None, max_length=60)
    description: Optional[str] = Field(default=None, max_length=500)
    data: Optional[dict[str, Any]] = None

    def normalized(self) -> "ComponentUpdate":
        if self.slug is not None:
            self.slug = validate_component_slug(self.slug)
        if self.type is not None:
            self.type = self.type.strip()
            if not self.type:
                raise ValueError("type is required")
        return self


class ComponentOut(BaseModel):
    id: int
    slug: str
    title: str
    type: str
    description: Optional[str] = None
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ComponentListOut(BaseModel):
    items: list[ComponentOut]
    total: int
    limit: int
    offset: int

