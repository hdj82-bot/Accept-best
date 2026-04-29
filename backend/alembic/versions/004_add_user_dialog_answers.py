"""add user_dialog_answers + paper_diagnoses.issues_with_questions

Revision ID: 004
Revises: 003
Create Date: 2026-04-29

소크라테스식 대화 정책 (academi.md "대화 정책") 적용:
- user_dialog_answers: 연구자가 시스템 질문에 회신한 답변 누적 (generic).
  여러 서비스가 service_name + context_id 로 구분해 공유한다.
- paper_diagnoses.issues_with_questions: 단정형 recommendations 외에
  되묻기 질문 묶음을 JSONB 로 보관 (nullable, 기존 행은 NULL).

본 마이그레이션은 generic 모델만 만든다. 만약 별도 PR 에서 survey 전용
user_answers 테이블이 먼저 생성됐다면 머지 시 본 generic 테이블로 통합 하고
survey 측을 view 로 대체하거나 폐기한다 (rebase 시 충돌 해결 가이드).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004"
down_revision: Union[str, None] = "003"
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
