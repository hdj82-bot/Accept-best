"""add performance indexes

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-03

Adds missing indexes for frequently queried columns:
- papers: published_at (year filter), source (source filter)
- papers: GIN index on title for ILIKE search
- payments: composite (user_id, status) for payment history
- paper_versions: user_id (already in model, missing from migrations)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # papers: year/date filter optimization
    op.create_index(
        "ix_papers_published_at",
        "papers",
        ["published_at"],
    )
    op.create_index(
        "ix_papers_source",
        "papers",
        ["source"],
    )

    # pg_trgm extension (safe inside transaction)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # payments: composite index for user payment history queries
    op.create_index(
        "ix_payments_user_id_status",
        "payments",
        ["user_id", "status"],
    )

    # paper_versions: user_id (defined in model but missing from migration)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_paper_versions_user_id "
        "ON paper_versions (user_id)"
    )

    # papers: GIN trigram index for ILIKE keyword search.
    # CONCURRENTLY cannot run inside a transaction — use autocommit_block.
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_papers_title_trgm "
            "ON papers USING gin (title gin_trgm_ops)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_papers_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_paper_versions_user_id")
    op.drop_index("ix_payments_user_id_status", table_name="payments")
    op.drop_index("ix_papers_source", table_name="papers")
    op.drop_index("ix_papers_published_at", table_name="papers")
