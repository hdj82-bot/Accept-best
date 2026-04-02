"""create initial 6 tables with pgvector

Revision ID: 001
Revises: None
Create Date: 2026-04-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector 익스텐션 활성화
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("provider", sa.String(20), nullable=False, server_default="google"),
        sa.Column("plan", sa.String(10), nullable=False, server_default="free"),
        sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 2. monthly_usage
    op.create_table(
        "monthly_usage",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year_month", sa.String(7), nullable=False),
        sa.Column("research_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("survey_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("summary_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("healthcheck_count", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "year_month", name="uq_usage_user_month"),
    )

    # 3. papers — embedding vector(1536) 절대 변경 금지
    op.create_table(
        "papers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("abstract", sa.Text, nullable=True),
        sa.Column("author_ids", sa.ARRAY(sa.Text), nullable=True),
        sa.Column("keywords", sa.ARRAY(sa.Text), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("source_id", sa.String(100), nullable=False),
        sa.Column("pdf_url", sa.Text, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("source", "source_id", name="uq_papers_source"),
    )
    # pgvector 컬럼은 raw SQL로 추가 (alembic이 vector 타입 미지원)
    op.execute("ALTER TABLE papers ADD COLUMN embedding vector(1536)")

    # 4. survey_questions — 핵심 차별점
    op.create_table(
        "survey_questions",
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
            nullable=False,
        ),
        sa.Column("original_q", sa.Text, nullable=False),
        sa.Column("adapted_q", sa.Text, nullable=False),
        sa.Column("source_title", sa.Text, nullable=True),
        sa.Column("source_page", sa.Integer, nullable=True),
        sa.Column("year", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_survey_user", "survey_questions", ["user_id"])

    # 5. paper_versions
    op.create_table(
        "paper_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", JSONB, nullable=False),
        sa.Column(
            "save_type",
            sa.String(10),
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_paper_versions_user", "paper_versions", ["user_id"])

    # 6. research_notes
    op.create_table(
        "research_notes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_research_notes_user", "research_notes", ["user_id"])


def downgrade() -> None:
    op.drop_table("research_notes")
    op.drop_table("paper_versions")
    op.drop_table("survey_questions")
    op.drop_table("papers")
    op.drop_table("monthly_usage")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
