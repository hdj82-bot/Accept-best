"""add survey_user_answers table

소크라테스식 대화 정책: 사용자가 사전 질문 단계에서 답한 내용을 누적해
다음 작업 컨텍스트와 익명화 집계에 활용한다 (academi.md '대화 정책').

Revision ID: 004
Revises: 003
Create Date: 2026-04-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "survey_user_answers",
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
            sa.ForeignKey("papers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("variable", sa.Text, nullable=True),
        sa.Column("answer_json", sa.JSON, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_survey_user_answers_user", "survey_user_answers", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_survey_user_answers_user", table_name="survey_user_answers")
    op.drop_table("survey_user_answers")
