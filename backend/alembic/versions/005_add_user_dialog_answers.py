"""add user_dialog_answers + paper_diagnoses.issues_with_questions

Revision ID: 005
Revises: 004
Create Date: 2026-04-29

소크라테스식 대화 정책 (academi.md "대화 정책") 적용:
- user_dialog_answers: 연구자가 시스템 질문에 회신한 답변 누적 (generic).
  여러 서비스가 service_name + context_id 로 구분해 공유한다.
- paper_diagnoses.issues_with_questions: 단정형 recommendations 외에
  되묻기 질문 묶음을 JSONB 로 보관 (nullable, 기존 행은 NULL).

원래 PR #41 에서 revision="004" 로 작성됐으나 PR #40 의 004
(survey_user_answers) 와 alembic head 가 분기됨. 시간상 먼저 머지된 survey 를
004 로 유지하고 본 마이그레이션을 005 로 rename 하여 chain 을 직선화한다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_dialog_answers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("service_name", sa.String(32), nullable=False),
        sa.Column("context_id", sa.String(36), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("answer", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_user_dialog_answers_user_service_context",
        "user_dialog_answers",
        ["user_id", "service_name", "context_id"],
    )

    op.add_column(
        "paper_diagnoses",
        sa.Column("issues_with_questions", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("paper_diagnoses", "issues_with_questions")
    op.drop_index(
        "ix_user_dialog_answers_user_service_context",
        table_name="user_dialog_answers",
    )
    op.drop_table("user_dialog_answers")
