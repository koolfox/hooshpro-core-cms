"""add taxonomies + terms

Revision ID: a9c1d3e5f7b9
Revises: f2a0b6c8d9e1
Create Date: 2025-12-30

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9c1d3e5f7b9"
down_revision: Union[str, Sequence[str], None] = "f2a0b6c8d9e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "taxonomies" not in tables:
        op.create_table(
            "taxonomies",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("slug", sa.String(length=200), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("hierarchical", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("taxonomies", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_taxonomies_slug"), ["slug"], unique=True)

    if "terms" not in tables:
        op.create_table(
            "terms",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("taxonomy_id", sa.Integer(), nullable=False),
            sa.Column("parent_id", sa.Integer(), nullable=True),
            sa.Column("slug", sa.String(length=200), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["parent_id"], ["terms.id"]),
            sa.ForeignKeyConstraint(["taxonomy_id"], ["taxonomies.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("taxonomy_id", "slug", name="uq_terms_taxonomy_slug"),
        )
        with op.batch_alter_table("terms", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_terms_taxonomy_id"), ["taxonomy_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_terms_parent_id"), ["parent_id"], unique=False)

    if "term_relationships" not in tables:
        op.create_table(
            "term_relationships",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("term_id", sa.Integer(), nullable=False),
            sa.Column("content_entry_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["content_entry_id"], ["content_entries.id"]),
            sa.ForeignKeyConstraint(["term_id"], ["terms.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("term_id", "content_entry_id", name="uq_term_relationships_term_entry"),
        )
        with op.batch_alter_table("term_relationships", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_term_relationships_term_id"), ["term_id"], unique=False)
            batch_op.create_index(batch_op.f("ix_term_relationships_content_entry_id"), ["content_entry_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "term_relationships" in tables:
        with op.batch_alter_table("term_relationships", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_term_relationships_content_entry_id"))
            batch_op.drop_index(batch_op.f("ix_term_relationships_term_id"))
        op.drop_table("term_relationships")

    if "terms" in tables:
        with op.batch_alter_table("terms", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_terms_parent_id"))
            batch_op.drop_index(batch_op.f("ix_terms_taxonomy_id"))
        op.drop_table("terms")

    if "taxonomies" in tables:
        with op.batch_alter_table("taxonomies", schema=None) as batch_op:
            batch_op.drop_index(batch_op.f("ix_taxonomies_slug"))
        op.drop_table("taxonomies")

