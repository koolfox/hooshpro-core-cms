from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

RESERVED_SLUGS = {
    "admin",
    "login",
    "logout",
    "media",
    "api",
    "auth",
    "none",
}


def validate_menu_slug(slug: str) -> str:
    s = slug.strip().lower()
    if s in RESERVED_SLUGS:
        raise ValueError(f"Slug '{s}' is reserved.")
    if not SLUG_RE.match(s):
        raise ValueError("Slug must be lowercase letters/numbers with hyphens (e.g. main-nav)")
    return s


class MenuCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "MenuCreate":
        self.slug = validate_menu_slug(self.slug)
        self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class MenuUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "MenuUpdate":
        if self.slug is not None:
            self.slug = validate_menu_slug(self.slug)
        if self.title is not None:
            self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class MenuOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MenuListOut(BaseModel):
    items: list[MenuOut]
    total: int
    limit: int
    offset: int


class MenuItemCreate(BaseModel):
    type: str = Field(min_length=1, max_length=20)
    label: str = Field(min_length=1, max_length=200)
    page_id: Optional[int] = None
    href: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "MenuItemCreate":
        t = (self.type or "").strip().lower()
        if t not in ("page", "link"):
            raise ValueError("type must be page|link")
        self.type = t

        self.label = (self.label or "").strip()
        if not self.label:
            raise ValueError("label is required")

        if self.type == "page":
            if not isinstance(self.page_id, int) or self.page_id <= 0:
                raise ValueError("page_id is required for type=page")
            self.href = None

        if self.type == "link":
            href = (self.href or "").strip()
            if not href:
                raise ValueError("href is required for type=link")
            self.href = href[:500]
            self.page_id = None

        return self


class MenuItemUpdate(BaseModel):
    label: Optional[str] = Field(default=None, max_length=200)
    page_id: Optional[int] = None
    href: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "MenuItemUpdate":
        if self.label is not None:
            self.label = (self.label or "").strip()
            if not self.label:
                raise ValueError("label is required")
        if self.href is not None:
            self.href = (self.href or "").strip()[:500] or None
        return self


class MenuItemOut(BaseModel):
    id: int
    menu_id: int
    type: str
    label: str
    page_id: Optional[int] = None
    href: Optional[str] = None
    order_index: int
    page_slug: Optional[str] = None
    page_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MenuItemListOut(BaseModel):
    items: list[MenuItemOut]


class MenuReorder(BaseModel):
    item_ids: list[int] = Field(default_factory=list)


class PublicMenuItemOut(BaseModel):
    label: str
    href: str


class PublicMenuOut(BaseModel):
    slug: str
    title: str
    items: list[PublicMenuItemOut] = Field(default_factory=list)

