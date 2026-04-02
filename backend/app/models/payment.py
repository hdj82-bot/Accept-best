import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Enum, func
from sqlalchemy.dialects.postgresql import UUID

from .base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    plan = Column(String, nullable=False)
    months = Column(Integer, nullable=False, default=1)
    amount = Column(Integer, nullable=False)
    portone_payment_id = Column(String, nullable=True, unique=True, index=True)
    status = Column(
        Enum("pending", "paid", "failed", "cancelled", name="payment_status_enum"),
        nullable=False,
        default="pending",
    )
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
