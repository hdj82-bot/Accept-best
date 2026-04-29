"""add translation_count + expression_count to monthly_usage

Revision ID: 006
Revises: 005
Create Date: 2026-04-29

backend/app/models/monthly_usage.py 모델엔 translation_count 와
expression_count 가 정의되어 있으나 alembic 001_initial_tables 에는 누락
되어 있어 production DB 에 두 컬럼이 없다. 번역/표현 수정 카운터를 INSERT/
UPDATE 하면 UndefinedColumn 에러 (500) 발생.

테스트 DB 는 conftest.py 의 Base.metadata.create_all 로 모델로부터 직접
생성되므로 컬럼이 자동 존재 → 테스트는 PASS, production 만 결함.

server_default="0" 부여 — 기존 row 안전(NULL 위반 없음).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "monthly_usage",
        sa.Column(
            "translation_count",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "monthly_usage",
        sa.Column(
            "expression_count",
            sa.Integer,
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("monthly_usage", "expression_count")
    op.drop_column("monthly_usage", "translation_count")
