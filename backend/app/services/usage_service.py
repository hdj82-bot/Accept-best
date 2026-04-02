from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monthly_usage import MonthlyUsage


async def increment_usage(user_id: str, db: AsyncSession) -> int:
    """
    UPSERT research_count for the current month.
    Returns the updated research_count.
    """
    year_month = datetime.now().strftime("%Y-%m")

    await db.execute(
        text("""
            INSERT INTO monthly_usage (user_id, year_month, research_count)
            VALUES (:user_id, :ym, 1)
            ON CONFLICT (user_id, year_month)
            DO UPDATE SET research_count = monthly_usage.research_count + 1
        """),
        {"user_id": user_id, "ym": year_month},
    )
    await db.commit()

    row = await db.execute(
        text(
            "SELECT research_count FROM monthly_usage "
            "WHERE user_id = :user_id AND year_month = :ym"
        ),
        {"user_id": user_id, "ym": year_month},
    )
    return row.scalar_one()


async def get_current_month_usage(user_id: str, db: AsyncSession) -> int:
    """Return this month's research_count (0 if no row yet)."""
    year_month = datetime.now().strftime("%Y-%m")
    row = await db.execute(
        text(
            "SELECT research_count FROM monthly_usage "
            "WHERE user_id = :user_id AND year_month = :ym"
        ),
        {"user_id": user_id, "ym": year_month},
    )
    return row.scalar_one_or_none() or 0


async def get_usage_history(user_id: str, db: AsyncSession, months: int = 6) -> list[MonthlyUsage]:
    """Return the most recent `months` monthly_usage rows for a user."""
    from sqlalchemy import select, desc
    from app.models.monthly_usage import MonthlyUsage

    result = await db.execute(
        select(MonthlyUsage)
        .where(MonthlyUsage.user_id == user_id)
        .order_by(desc(MonthlyUsage.year_month))
        .limit(months)
    )
    return list(result.scalars().all())
