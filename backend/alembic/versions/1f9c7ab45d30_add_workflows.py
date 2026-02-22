"""add workflows and workflow_runs

Revision ID: 1f9c7ab45d30
Revises: c7d8e9f0a1b2
Create Date: 2026-02-22 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1f9c7ab45d30"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("trigger_event", sa.String(length=120), nullable=False, server_default="manual"),
        sa.Column(
            "definition_json",
            sa.Text(),
            nullable=False,
            server_default='{"version":1,"nodes":[],"edges":[]}',
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workflows_slug"), "workflows", ["slug"], unique=True)
    op.create_index(op.f("ix_workflows_status"), "workflows", ["status"], unique=False)
    op.create_index(op.f("ix_workflows_trigger_event"), "workflows", ["trigger_event"], unique=False)

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("input_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("output_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("error_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workflow_runs_workflow_id"), "workflow_runs", ["workflow_id"], unique=False)
    op.create_index(op.f("ix_workflow_runs_status"), "workflow_runs", ["status"], unique=False)
    op.create_index(op.f("ix_workflow_runs_created_at"), "workflow_runs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_workflow_runs_created_at"), table_name="workflow_runs")
    op.drop_index(op.f("ix_workflow_runs_status"), table_name="workflow_runs")
    op.drop_index(op.f("ix_workflow_runs_workflow_id"), table_name="workflow_runs")
    op.drop_table("workflow_runs")

    op.drop_index(op.f("ix_workflows_trigger_event"), table_name="workflows")
    op.drop_index(op.f("ix_workflows_status"), table_name="workflows")
    op.drop_index(op.f("ix_workflows_slug"), table_name="workflows")
    op.drop_table("workflows")
