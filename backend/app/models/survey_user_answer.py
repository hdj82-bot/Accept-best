import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class SurveyUserAnswer(Base):
    """사용자가 사전 질문 단계에서 답한 내용 누적용 테이블.

    소크라테스식 대화 정책 (academi.md '대화 정책' 섹션) 데이터 기반.
    개인 작업 컨텍스트 재사용 + 익명화·집계된 패턴 분석에 사용된다.
    """

    __tablename__ = "survey_user_answers"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    paper_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    variable: Mapped[str | None] = mapped_column(Text)
    answer_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
