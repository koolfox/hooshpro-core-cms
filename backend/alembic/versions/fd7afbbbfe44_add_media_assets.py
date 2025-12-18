"""add media_assets

Revision ID: fd7afbbbfe44
Revises: 79769d50d480
Create Date: 2025-12-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "fd7afbbbfe44"
down_revision: Union[str, Sequence[str], None] = "79769d50d480"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "media_assets" in inspector.get_table_names():
        return

    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("original_name", sa.String(length=400), nullable=False),
        sa.Column("stored_name", sa.String(length=400), nullable=False),
        sa.Column("content_type", sa.String(length=200), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("media_assets", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_media_assets_stored_name"),
            ["stored_name"],
            unique=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "media_assets" not in inspector.get_table_names():
        return

    with op.batch_alter_table("media_assets", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_media_assets_stored_name"))

    op.drop_table("media_assets")

