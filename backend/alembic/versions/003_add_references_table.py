"""add references table

Revision ID: 003
Revises: 002
Create Date: 2026-04-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "references",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "paper_id",
            sa.String(36),
            sa.ForeignKey("papers.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("authors", sa.Text, nullable=True),
        sa.Column("journal", sa.Text, nullable=True),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column("doi", sa.String(255), nullable=True),
        sa.Column("citation_text", sa.Text, nullable=True),
        sa.Column("memo", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_references_user", "references", ["user_id"])


def downgrade() -> None:
    op.drop_table("references")
