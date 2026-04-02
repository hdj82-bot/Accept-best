import uuid
from datetime import datetime

from sqlalchemy import Column, String, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import Base


class PaperVersion(Base):
    __tablename__ = "paper_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content = Column(JSONB, nullable=False)
    save_type = Column(
        Enum("auto", "manual", name="save_type_enum"),
        nullable=False,
        default="auto",
    )
    label = Column(String(255), nullable=True)        # optional user label for manual saves
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
