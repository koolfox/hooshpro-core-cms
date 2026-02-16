"""add options

Revision ID: f2a0b6c8d9e1
Revises: e599ea19ac34
Create Date: 2025-12-30

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a0b6c8d9e1"
down_revision: Union[str, Sequence[str], None] = "e599ea19ac34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "options" in tables:
        return

    op.create_table(
        "options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("value_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("options", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_options_key"), ["key"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "options" not in tables:
        return

    with op.batch_alter_table("options", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_options_key"))

    op.drop_table("options")

