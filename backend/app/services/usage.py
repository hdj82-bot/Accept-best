from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def increment_usage(user_id: str, field: str, db: AsyncSession) -> None:
    allowed_fields = {
        "research_count",
        "survey_count",
        "summary_count",
        "diagnosis_count",
    }
    if field not in allowed_fields:
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
