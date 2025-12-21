"""add page_templates.definition_json

Revision ID: c4e5f6a7b8c9
Revises: b1c2d3e4f5a6
Create Date: 2025-12-20

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
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
    if "definition_json" in columns:
        return

    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "definition_json",
                sa.Text(),
                nullable=False,
                server_default='{"version":3,"layout":{"rows":[]}}',
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
    if "definition_json" not in columns:
        return

    with op.batch_alter_table("page_templates", schema=None) as batch_op:
        batch_op.drop_column("definition_json")

