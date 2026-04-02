from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import QuotaExceededError
from app.models.monthly_usage import MonthlyUsage

# 플랜별 월간 한도 정의
PLAN_LIMITS: dict[str, dict[str, int]] = {
    "free": {
        "research_count": 5,
        "survey_count": 3,
        "summary_count": 10,
        "diagnosis_count": 2,
    },
    "basic": {
        "research_count": 30,
        "survey_count": 20,
        "summary_count": 50,
        "diagnosis_count": 10,
    },
    "pro": {
        "research_count": -1,  # 무제한
        "survey_count": -1,
        "summary_count": -1,
        "diagnosis_count": -1,
    },
}

ALLOWED_FIELDS = {"research_count", "survey_count", "summary_count", "diagnosis_count"}


async def get_usage(user_id: str, db: AsyncSession) -> MonthlyUsage | None:
    """현재 월의 사용량 조회. 레코드가 없으면 None 반환."""
    year_month = datetime.now().strftime("%Y-%m")
    result = await db.execute(
        select(MonthlyUsage).where(
            MonthlyUsage.user_id == user_id,
            MonthlyUsage.year_month == year_month,
        )
    )
    return result.scalar_one_or_none()


async def check_quota(user_id: str, field: str, plan: str, db: AsyncSession) -> None:
    """한도 초과 시 QuotaExceededError 발생. pro 플랜은 무제한."""
    if field not in ALLOWED_FIELDS:
        raise ValueError(f"Invalid usage field: {field}")

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    limit = limits[field]
    if limit == -1:  # 무제한
        return

    usage = await get_usage(user_id, db)
    current = getattr(usage, field, 0) if usage else 0
    if current >= limit:
        raise QuotaExceededError(field)


async def increment_usage(user_id: str, field: str, db: AsyncSession) -> None:
    """사용량 카운터 1 증가. INSERT ON CONFLICT 패턴."""
    if field not in ALLOWED_FIELDS:
        raise ValueError(f"Invalid usage field: {field}")

    year_month = datetime.now().strftime("%Y-%m")
    await db.execute(
        text(f"""
            INSERT INTO monthly_usage (user_id, year_month, {field})
            VALUES (:user_id, :ym, 1)
            ON CONFLICT (user_id, year_month)
            DO UPDATE SET {field} = monthly_usage.{field} + 1
        """),
        {"user_id": user_id, "ym": year_month},
    )
    await db.commit()
