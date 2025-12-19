"""add media_folders + media_assets.folder_id

Revision ID: 9a6b2c1d4e8f
Revises: 03628574cad2
Create Date: 2025-12-19

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9a6b2c1d4e8f"
down_revision: Union[str, Sequence[str], None] = "03628574cad2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FK_MEDIA_ASSETS_FOLDER = "fk_media_assets_folder_id_media_folders"


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "media_folders" not in tables:
        op.create_table(
            "media_folders",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("parent_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["parent_id"], ["media_folders.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("media_folders", schema=None) as batch_op:
            batch_op.create_index(batch_op.f("ix_media_folders_parent_id"), ["parent_id"], unique=False)

    if "media_assets" not in tables:
        return

    columns = {c["name"] for c in inspector.get_columns("media_assets")}
    if "folder_id" in columns:
        return

    with op.batch_alter_table("media_assets", schema=None) as batch_op:
        batch_op.add_column(sa.Column("folder_id", sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f("ix_media_assets_folder_id"), ["folder_id"], unique=False)
        batch_op.create_foreign_key(
            FK_MEDIA_ASSETS_FOLDER,
            "media_folders",
            ["folder_id"],
            ["id"],
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "media_assets" in tables:
        columns = {c["name"] for c in inspector.get_columns("media_assets")}
        if "folder_id" in columns:
            with op.batch_alter_table("media_assets", schema=None) as batch_op:
                batch_op.drop_constraint(FK_MEDIA_ASSETS_FOLDER, type_="foreignkey")
                batch_op.drop_index(batch_op.f("ix_media_assets_folder_id"))
                batch_op.drop_column("folder_id")

    if "media_folders" not in tables:
        return

    with op.batch_alter_table("media_folders", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_media_folders_parent_id"))

    op.drop_table("media_folders")

