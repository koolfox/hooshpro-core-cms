"""add page_templates

Revision ID: 5c3d2a1b9f0e
Revises: 9a6b2c1d4e8f
Create Date: 2025-12-19

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5c3d2a1b9f0e"
down_revision: Union[str, Sequence[str], None] = "9a6b2c1d4e8f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "page_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("menu", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_page_templates_slug"), ["slug"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_page_templates_slug"))

    op.drop_table("page_templates")

