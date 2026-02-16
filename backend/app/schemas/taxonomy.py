from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.page import validate_slug


class TaxonomyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    hierarchical: bool = Field(default=False)

    def normalized(self) -> "TaxonomyCreate":
        self.slug = validate_slug(self.slug)
        self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class TaxonomyUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    hierarchical: Optional[bool] = None

    def normalized(self) -> "TaxonomyUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.title is not None:
            self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class TaxonomyOut(BaseModel):
    id: int
    slug: str
    title: str
    description: Optional[str] = None
    hierarchical: bool
    created_at: datetime
    updated_at: datetime


class TaxonomyListOut(BaseModel):
    items: list[TaxonomyOut]
    total: int
    limit: int
    offset: int


class TermCreate(BaseModel):
    taxonomy_id: int | None = None
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[int] = None

    def normalized(self) -> "TermCreate":
        self.slug = validate_slug(self.slug)
        self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        if self.parent_id is not None and self.parent_id <= 0:
            self.parent_id = None
        return self


class TermUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    parent_id: Optional[int] = None

    def normalized(self) -> "TermUpdate":
        if self.slug is not None:
            self.slug = validate_slug(self.slug)
        if self.title is not None:
            self.title = self.title.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        if self.parent_id is not None and self.parent_id <= 0:
            self.parent_id = None
        return self


class TermOut(BaseModel):
    id: int
    taxonomy_id: int
    parent_id: Optional[int] = None
    slug: str
    title: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TermListOut(BaseModel):
    items: list[TermOut]
    total: int
    limit: int
    offset: int


class EntryTermOut(BaseModel):
    id: int
    taxonomy_id: int
    taxonomy_slug: str
    taxonomy_title: str
    slug: str
    title: str


class EntryTermListOut(BaseModel):
    items: list[EntryTermOut]


class EntryTermSetIn(BaseModel):
    term_ids: list[int] = Field(default_factory=list)


class PublicTaxonomyOut(BaseModel):
    slug: str
    title: str


class PublicTermOut(BaseModel):
    id: int
    taxonomy_slug: str
    slug: str
    title: str
    description: Optional[str] = None


class PublicTermListOut(BaseModel):
    items: list[PublicTermOut]

