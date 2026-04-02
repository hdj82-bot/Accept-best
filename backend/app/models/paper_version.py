import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class PaperVersion(Base):
    __tablename__ = "paper_versions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    save_type: Mapped[str] = mapped_column(
        String(10), nullable=False, default="manual"
    )  # auto / manual
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
