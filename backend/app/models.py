from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import Boolean, String, Integer, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)

    status: Mapped[str] = mapped_column(String(20), index=True, default="draft")

    seo_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    blocks_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='{"version":1,"blocks":[]}',
    )

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class PageTemplate(Base):
    __tablename__ = "page_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    menu: Mapped[str] = mapped_column(String(60), nullable=False, default="main")
    footer: Mapped[str] = mapped_column(String(60), nullable=False, default="none")

    definition_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='{"version":3,"layout":{"rows":[]}}',
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class Menu(Base):
    __tablename__ = "menus"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    items: Mapped[list["MenuItem"]] = relationship(
        back_populates="menu",
        cascade="all, delete-orphan",
        order_by="MenuItem.order_index",
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    menu_id: Mapped[int] = mapped_column(ForeignKey("menus.id"), index=True)

    type: Mapped[str] = mapped_column(String(20), nullable=False, default="link")
    label: Mapped[str] = mapped_column(String(200), nullable=False)

    page_id: Mapped[int | None] = mapped_column(
        ForeignKey("pages.id"),
        nullable=True,
        index=True,
    )

    href: Mapped[str | None] = mapped_column(String(500), nullable=True)

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    menu: Mapped["Menu"] = relationship(back_populates="items")


class MediaFolder(Base):
    __tablename__ = "media_folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_folders.id"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_folders.id"),
        nullable=True,
        index=True,
    )

    original_name: Mapped[str] = mapped_column(String(400), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(400), unique=True, index=True, nullable=False)

    content_type: Mapped[str] = mapped_column(String(200), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Component(Base):
    __tablename__ = "components"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    type: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    data_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class BlockTemplate(Base):
    __tablename__ = "blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    definition_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='{"version":3,"layout":{"rows":[]}}',
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class ContentType(Base):
    __tablename__ = "content_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    fields: Mapped[list["ContentField"]] = relationship(
        back_populates="content_type",
        cascade="all, delete-orphan",
        order_by="ContentField.order_index",
    )
    entries: Mapped[list["ContentEntry"]] = relationship(
        back_populates="content_type",
        cascade="all, delete-orphan",
        order_by="ContentEntry.updated_at.desc()",
    )


class ContentField(Base):
    __tablename__ = "content_fields"

    __table_args__ = (
        UniqueConstraint("content_type_id", "slug", name="uq_content_fields_type_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    content_type_id: Mapped[int] = mapped_column(ForeignKey("content_types.id"), index=True)

    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    field_type: Mapped[str] = mapped_column(String(60), nullable=False)

    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    options_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    content_type: Mapped["ContentType"] = relationship(back_populates="fields")


class ContentEntry(Base):
    __tablename__ = "content_entries"

    __table_args__ = (
        UniqueConstraint("content_type_id", "slug", name="uq_content_entries_type_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    content_type_id: Mapped[int] = mapped_column(ForeignKey("content_types.id"), index=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), index=True, default="draft")

    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    data_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    content_type: Mapped["ContentType"] = relationship(back_populates="entries")


class Option(Base):
    __tablename__ = "options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    value_json: Mapped[str] = mapped_column(Text, nullable=False, default="null")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class Theme(Base):
    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    vars_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class Taxonomy(Base):
    __tablename__ = "taxonomies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hierarchical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class Term(Base):
    __tablename__ = "terms"

    __table_args__ = (
        UniqueConstraint("taxonomy_id", "slug", name="uq_terms_taxonomy_slug"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    taxonomy_id: Mapped[int] = mapped_column(ForeignKey("taxonomies.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("terms.id"), nullable=True, index=True)

    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class TermRelationship(Base):
    __tablename__ = "term_relationships"

    __table_args__ = (
        UniqueConstraint("term_id", "content_entry_id", name="uq_term_relationships_term_entry"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("terms.id"), index=True)
    content_entry_id: Mapped[int] = mapped_column(ForeignKey("content_entries.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
