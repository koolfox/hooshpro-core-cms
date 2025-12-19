"""add components and blocks

Revision ID: 03628574cad2
Revises: fd7afbbbfe44
Create Date: 2025-12-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "03628574cad2"
down_revision: Union[str, Sequence[str], None] = "fd7afbbbfe44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "components",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=60), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("components", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_components_slug"), ["slug"], unique=True)
        batch_op.create_index(batch_op.f("ix_components_type"), ["type"], unique=False)

    op.create_table(
        "blocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("definition_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("blocks", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_blocks_slug"), ["slug"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("blocks", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_blocks_slug"))

    op.drop_table("blocks")

    with op.batch_alter_table("components", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_components_type"))
        batch_op.drop_index(batch_op.f("ix_components_slug"))

    op.drop_table("components")

