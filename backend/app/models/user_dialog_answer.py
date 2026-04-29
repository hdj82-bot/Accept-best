import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class UserDialogAnswer(Base):
    """소크라테스식 대화에서 연구자가 시스템 질문에 회신한 답변 누적 저장.

    여러 서비스(summary / survey / diagnosis / note_to_draft)가 공유하는
    generic 테이블. service_name 으로 origin 을 구분하고 context_id 로
    paper_id / note_id 등 도메인 식별자를 둔다 (cross-table FK 는 두지 않는다 —
    서비스마다 다른 테이블을 가리키므로).
    """

    __tablename__ = "user_dialog_answers"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    service_name: Mapped[str] = mapped_column(String(32), nullable=False)
    context_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
