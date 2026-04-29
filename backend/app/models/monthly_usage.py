from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "year_month", name="uq_user_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    year_month: Mapped[str] = mapped_column(String(7), nullable=False)  # "2026-04"
    research_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    survey_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    summary_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    healthcheck_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    translation_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    expression_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
