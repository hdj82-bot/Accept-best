import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class Diagnosis(Base):
    __tablename__ = "paper_diagnoses"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    paper_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    sections: Mapped[dict] = mapped_column(JSONB, nullable=False)
    recommendations: Mapped[list] = mapped_column(JSONB, nullable=False)
    # 소크라테스식 정책: 단정형 recommendations 외에 연구자에게 되묻는 질문 묶음.
    # 기존 행은 NULL 이며 점진 백필 대상.
    issues_with_questions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
