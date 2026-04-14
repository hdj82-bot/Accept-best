from datetime import datetime, timezone

from sqlalchemy import text

from app.models.database import get_db

# 플랜별 월간 한도
PLAN_LIMITS = {
    "free":  {"research_count": 5,   "survey_count": 3,   "summary_count": 10,  "healthcheck_count": 3},
    "basic": {"research_count": 30,  "survey_count": 20,  "summary_count": 100, "healthcheck_count": 20},
    "pro":   {"research_count": 999, "survey_count": 999, "summary_count": 999, "healthcheck_count": 999},
}


async def get_monthly_usage(user_id: str) -> dict:
    """현재 월의 사용량을 조회한다."""
    year_month = datetime.now(timezone.utc).strftime("%Y-%m")
    async for db in get_db():
        result = await db.execute(
            text(
                "SELECT research_count, survey_count, summary_count, healthcheck_count "
                "FROM monthly_usage WHERE user_id = :user_id AND year_month = :ym"
            ),
            {"user_id": user_id, "ym": year_month},
        )
        row = result.mappings().first()
        if row is None:
            return {"research_count": 0, "survey_count": 0, "summary_count": 0, "healthcheck_count": 0}
        return dict(row)


async def check_quota(user_id: str, plan: str, field: str) -> bool:
    """해당 기능의 월간 한도를 초과했는지 확인한다.
    True면 사용 가능, False면 한도 초과."""
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    max_count = limits.get(field, 0)
    usage = await get_monthly_usage(user_id)
    return usage.get(field, 0) < max_count


async def get_plan_info(plan: str) -> dict:
    """플랜 이름으로 한도 정보를 반환한다."""
    return {
        "plan": plan,
        "limits": PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]),
    }
