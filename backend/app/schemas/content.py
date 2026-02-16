from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.page import validate_slug

ALLOWED_FIELD_TYPES = {
    "string",
    "text",
    "number",
    "boolean",
    "datetime",
    "media",
    "select",
}


def validate_field_type(field_type: str) -> str:
    ft = field_type.strip().lower()
    if ft not in ALLOWED_FIELD_TYPES:
        raise ValueError(
            "field_type must be one of: " + ", ".join(sorted(ALLOWED_FIELD_TYPES))
        )
    return ft


def _safe_load_json(text: str | None, fallback: dict) -> dict:
    if not text:
        return fallback
    try:
        v = json.loads(text)
        return v if isinstance(v, dict) else fallback
    except Exception:
        return fallback


def _safe_dump_json(data: dict) -> str:
    return json.dumps(data or {}, ensure_ascii=False)


class ContentTypeCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "ContentTypeCreate":
        self.slug = validate_slug(self.slug)
        self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class ContentTypeUpdate(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=200)
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)

    def normalized(self) -> "ContentTypeUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.title is not None:
            self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class ContentTypeOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ContentTypeListOut(BaseModel):
    items: list[ContentTypeOut]
    total: int
    limit: int
    offset: int


class ContentFieldCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=200)
    field_type: str = Field(min_length=1, max_length=60)
    required: bool = False
    options: dict[str, Any] = Field(default_factory=dict)

    def normalized(self) -> "ContentFieldCreate":
        self.slug = validate_slug(self.slug)
        self.label = self.label.strip()
        self.field_type = validate_field_type(self.field_type)
        self.options = self.options or {}
        return self


class ContentFieldUpdate(BaseModel):
    slug: Optional[str] = Field(default=None, max_length=200)
    label: Optional[str] = Field(default=None, max_length=200)
    field_type: Optional[str] = Field(default=None, max_length=60)
    required: Optional[bool] = None
    options: Optional[dict[str, Any]] = None

    def normalized(self) -> "ContentFieldUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.label is not None:
            self.label = self.label.strip()
        if self.field_type is not None:
            self.field_type = validate_field_type(self.field_type)
        if self.options is not None:
            self.options = self.options or {}
        return self


class ContentFieldOut(BaseModel):
    id: int
    content_type_id: int
    slug: str
    label: str
    field_type: str
    required: bool
    options: dict[str, Any] = Field(default_factory=dict)
    order_index: int
    created_at: datetime
    updated_at: datetime


class ContentFieldListOut(BaseModel):
    items: list[ContentFieldOut]


class ContentFieldReorderIn(BaseModel):
    ids: list[int] = Field(min_length=1)


class ContentEntryCreate(BaseModel):
    content_type_slug: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    status: str = Field(default="draft")
    order_index: int = 0
    data: dict[str, Any] = Field(default_factory=dict)

    def normalized(self) -> "ContentEntryCreate":
        self.content_type_slug = validate_slug(self.content_type_slug)
        self.title = self.title.strip()
        self.slug = validate_slug(self.slug)
        if self.status not in ("draft", "published"):
            raise ValueError("status must be draft|published")
        self.order_index = int(self.order_index or 0)
        self.data = self.data or {}
        return self


class ContentEntryUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    status: Optional[str] = None
    order_index: Optional[int] = None
    data: Optional[dict[str, Any]] = None

    def normalized(self) -> "ContentEntryUpdate":
        if self.title is not None:
            self.title = self.title.strip()
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.status is not None and self.status not in ("draft", "published"):
            raise ValueError("status must be draft|published")
        if self.order_index is not None:
            self.order_index = int(self.order_index or 0)
        if self.data is not None:
            self.data = self.data or {}
        return self


class ContentEntryOut(BaseModel):
    id: int
    content_type_id: int
    content_type_slug: str
    title: str
    slug: str
    status: str
    order_index: int
    data: dict[str, Any] = Field(default_factory=dict)
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ContentEntryListOut(BaseModel):
    items: list[ContentEntryOut]
    total: int
    limit: int
    offset: int


class PublicContentEntryOut(BaseModel):
    id: int
    content_type_slug: str
    title: str
    slug: str
    data: dict[str, Any] = Field(default_factory=dict)
    published_at: Optional[datetime] = None


class PublicContentEntryListOut(BaseModel):
    items: list[PublicContentEntryOut]
    total: int
    limit: int
    offset: int


def load_field_options(text: str | None) -> dict[str, Any]:
    return _safe_load_json(text, {})


def dump_field_options(options: dict[str, Any]) -> str:
    return _safe_dump_json(options or {})


def load_entry_data(text: str | None) -> dict[str, Any]:
    return _safe_load_json(text, {})


def dump_entry_data(data: dict[str, Any]) -> str:
    return _safe_dump_json(data or {})

