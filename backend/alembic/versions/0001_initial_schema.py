"""initial schema: pgvector extension + 6 core tables

Revision ID: 0001
Revises:
Create Date: 2025-06-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── pgvector extension ────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── plan enum ─────────────────────────────────────────────────────────────
    op.execute("CREATE TYPE plan_enum AS ENUM ('free', 'basic', 'pro')")

    # ── save_type enum ────────────────────────────────────────────────────────
    op.execute("CREATE TYPE save_type_enum AS ENUM ('auto', 'manual')")

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("image", sa.String(), nullable=True),
        sa.Column("provider", sa.String(), nullable=False, server_default="google"),
        sa.Column("provider_account_id", sa.String(), nullable=True),
        sa.Column(
            "plan",
            sa.Enum("free", "basic", "pro", name="plan_enum", create_type=False),
            nullable=False,
            server_default="free",
        ),
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
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── monthly_usage ─────────────────────────────────────────────────────────
    op.create_table(
        "monthly_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year_month", sa.String(7), nullable=False),
        sa.Column(
            "research_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "summary_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "survey_count", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "embedding_count", sa.Integer(), nullable=False, server_default="0"
        ),
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
        sa.UniqueConstraint(
            "user_id", "year_month", name="uq_monthly_usage_user_month"
        ),
    )
    op.create_index("ix_monthly_usage_user_id", "monthly_usage", ["user_id"])

    # ── papers ────────────────────────────────────────────────────────────────
    # pgvector type used via raw SQL for the embedding column
    op.create_table(
        "papers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(255), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("authors", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("author_ids", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("keywords", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("doi", sa.String(255), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("pdf_url", sa.Text(), nullable=True),
        sa.Column("citation_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
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
        sa.UniqueConstraint("source", "source_id", name="uq_papers_source_source_id"),
    )
    # Add vector column separately because SQLAlchemy core doesn't know the type
    op.execute(
        "ALTER TABLE papers ADD COLUMN embedding vector(1536)"
    )
    # Approximate nearest-neighbour index (IVFFlat) — created empty; build after bulk insert
    op.execute(
        "CREATE INDEX ix_papers_embedding_ivfflat "
        "ON papers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # ── survey_questions ──────────────────────────────────────────────────────
    op.create_table(
        "survey_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "paper_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("papers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("original_q", sa.Text(), nullable=False),
        sa.Column("adapted_q", sa.Text(), nullable=True),
        sa.Column("source_title", sa.Text(), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
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
    op.create_index("ix_survey_questions_user_id", "survey_questions", ["user_id"])
    op.create_index(
        "ix_survey_questions_paper_id", "survey_questions", ["paper_id"]
    )

    # ── paper_versions ────────────────────────────────────────────────────────
    op.create_table(
        "paper_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column(
            "save_type",
            sa.Enum("auto", "manual", name="save_type_enum", create_type=False),
            nullable=False,
            server_default="auto",
        ),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_paper_versions_user_id", "paper_versions", ["user_id"])

    # ── research_notes ────────────────────────────────────────────────────────
    op.create_table(
        "research_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
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
    op.create_index("ix_research_notes_user_id", "research_notes", ["user_id"])


def downgrade() -> None:
    op.drop_table("research_notes")
    op.drop_table("paper_versions")
    op.drop_table("survey_questions")
    op.drop_table("papers")
    op.drop_table("monthly_usage")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS save_type_enum")
    op.execute("DROP TYPE IF EXISTS plan_enum")
    op.execute("DROP EXTENSION IF EXISTS vector")
