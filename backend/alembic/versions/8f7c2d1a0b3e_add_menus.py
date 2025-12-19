"""add menus

Revision ID: 8f7c2d1a0b3e
Revises: 5c3d2a1b9f0e
Create Date: 2025-12-19

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f7c2d1a0b3e"
down_revision: Union[str, Sequence[str], None] = "5c3d2a1b9f0e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "menus",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("menus", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_menus_slug"), ["slug"], unique=True)

    op.create_table(
        "menu_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("menu_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=True),
        sa.Column("href", sa.String(length=500), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["menu_id"], ["menus.id"]),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("menu_items", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_menu_items_menu_id"), ["menu_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_menu_items_page_id"), ["page_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_menu_items_order_index"), ["order_index"], unique=False)
        batch_op.create_index(
            "ix_menu_items_menu_order",
            ["menu_id", "order_index"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("menu_items", schema=None) as batch_op:
        batch_op.drop_index("ix_menu_items_menu_order")
        batch_op.drop_index(batch_op.f("ix_menu_items_order_index"))
        batch_op.drop_index(batch_op.f("ix_menu_items_page_id"))
        batch_op.drop_index(batch_op.f("ix_menu_items_menu_id"))

    op.drop_table("menu_items")

    with op.batch_alter_table("menus", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_menus_slug"))

    op.drop_table("menus")

