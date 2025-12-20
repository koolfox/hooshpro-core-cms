"""add page_templates.footer

Revision ID: b1c2d3e4f5a6
Revises: 8f7c2d1a0b3e
Create Date: 2025-12-20

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "8f7c2d1a0b3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "page_templates" not in tables:
        return

    columns = {c["name"] for c in inspector.get_columns("page_templates")}
    if "footer" in columns:
        return

    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "footer",
                sa.String(length=60),
                nullable=False,
                server_default="none",
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "page_templates" not in tables:
        return

    columns = {c["name"] for c in inspector.get_columns("page_templates")}
    if "footer" not in columns:
        return

    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.drop_column("footer")

