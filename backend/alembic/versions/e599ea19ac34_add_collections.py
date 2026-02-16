"""add collections (content types + fields + entries)

Revision ID: e599ea19ac34
Revises: c4e5f6a7b8c9
Create Date: 2025-12-30

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e599ea19ac34"
down_revision: Union[str, Sequence[str], None] = "c4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "content_types" not in tables:
        op.create_table(
            "content_types",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("slug", sa.String(length=200), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("content_types", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_content_types_slug"), ["slug"], unique=True)

    if "content_entries" not in tables:
        op.create_table(
            "content_entries",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("content_type_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("slug", sa.String(length=200), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False),
            sa.Column("data_json", sa.Text(), nullable=False),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["content_type_id"], ["content_types.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("content_type_id", "slug", name="uq_content_entries_type_slug"),
        )
        with op.batch_alter_table("content_entries", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_content_entries_content_type_id"), ["content_type_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_content_entries_order_index"), ["order_index"], unique=False)
            batch_op.create_index(batch_op.f("ix_content_entries_slug"), ["slug"], unique=False)
            batch_op.create_index(batch_op.f("ix_content_entries_status"), ["status"], unique=False)

    if "content_fields" not in tables:
        op.create_table(
            "content_fields",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("content_type_id", sa.Integer(), nullable=False),
            sa.Column("slug", sa.String(length=200), nullable=False),
            sa.Column("label", sa.String(length=200), nullable=False),
            sa.Column("field_type", sa.String(length=60), nullable=False),
            sa.Column("required", sa.Boolean(), nullable=False),
            sa.Column("options_json", sa.Text(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["content_type_id"], ["content_types.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("content_type_id", "slug", name="uq_content_fields_type_slug"),
        )
        with op.batch_alter_table("content_fields", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_content_fields_content_type_id"), ["content_type_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_content_fields_order_index"), ["order_index"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "content_fields" in tables:
        with op.batch_alter_table("content_fields", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_content_fields_order_index"))
            batch_op.drop_index(batch_op.f("ix_content_fields_content_type_id"))
        op.drop_table("content_fields")

    if "content_entries" in tables:
        with op.batch_alter_table("content_entries", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_content_entries_status"))
            batch_op.drop_index(batch_op.f("ix_content_entries_slug"))
            batch_op.drop_index(batch_op.f("ix_content_entries_order_index"))
            batch_op.drop_index(batch_op.f("ix_content_entries_content_type_id"))
        op.drop_table("content_entries")

    if "content_types" in tables:
        with op.batch_alter_table("content_types", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_content_types_slug"))
        op.drop_table("content_types")
