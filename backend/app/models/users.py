import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=True)
    image = Column(String, nullable=True)
    provider = Column(String, nullable=False, default="google")
    provider_account_id = Column(String, nullable=True)
    plan = Column(
        Enum("free", "basic", "pro", name="plan_enum"),
        nullable=False,
        default="free",
    )
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
