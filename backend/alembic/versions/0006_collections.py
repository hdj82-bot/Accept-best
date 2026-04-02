"""add collections, collection_papers, paper_tags tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── collections ───────────────────────────────────────────────────────────
    op.create_table(
        "collections",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_collections_user_id", "collections", ["user_id"])

    # ── collection_papers ─────────────────────────────────────────────────────
    op.create_table(
        "collection_papers",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "collection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("collections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "paper_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("collection_id", "paper_id", name="uq_collection_paper"),
    )
    op.create_index("ix_collection_papers_collection_id", "collection_papers", ["collection_id"])
    op.create_index("ix_collection_papers_paper_id", "collection_papers", ["paper_id"])

    # ── paper_tags ────────────────────────────────────────────────────────────
    op.create_table(
        "paper_tags",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "paper_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(100), nullable=False),
        sa.UniqueConstraint("user_id", "paper_id", "tag", name="uq_paper_tag"),
    )
    op.create_index("ix_paper_tags_user_id", "paper_tags", ["user_id"])
    op.create_index("ix_paper_tags_paper_id", "paper_tags", ["paper_id"])


def downgrade() -> None:
    op.drop_index("ix_paper_tags_paper_id", table_name="paper_tags")
    op.drop_index("ix_paper_tags_user_id", table_name="paper_tags")
    op.drop_table("paper_tags")

    op.drop_index("ix_collection_papers_paper_id", table_name="collection_papers")
    op.drop_index("ix_collection_papers_collection_id", table_name="collection_papers")
    op.drop_table("collection_papers")

    op.drop_index("ix_collections_user_id", table_name="collections")
    op.drop_table("collections")
