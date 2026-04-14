from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.plan import PlanInfo, PlanLimit, UsageResponse
from app.services.usage import PLAN_LIMITS, get_usage

router = APIRouter(prefix="/plans", tags=["plans"])

PLAN_CATALOG: list[PlanInfo] = [
    PlanInfo(
        name="free",
        display_name="Free",
        price_krw=0,
        limits=PlanLimit(**PLAN_LIMITS["free"]),
    ),
    PlanInfo(
        name="basic",
        display_name="Basic",
        price_krw=9900,
        limits=PlanLimit(**PLAN_LIMITS["basic"]),
    ),
    PlanInfo(
        name="pro",
        display_name="Pro",
        price_krw=29900,
        limits=PlanLimit(**PLAN_LIMITS["pro"]),
    ),
]


@router.get("", response_model=list[PlanInfo])
async def list_plans():
    """플랜 목록 조회 (인증 불필요)."""
    return PLAN_CATALOG


@router.get("/usage", response_model=UsageResponse)
async def get_my_usage(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 현재 월 사용량 조회."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    plan = user.plan if user else "free"

    from datetime import datetime

    year_month = datetime.now().strftime("%Y-%m")

    usage_row = await get_usage(user_id, db)
    usage = {
        "research_count": usage_row.research_count if usage_row else 0,
        "survey_count": usage_row.survey_count if usage_row else 0,
        "summary_count": usage_row.summary_count if usage_row else 0,
        "diagnosis_count": usage_row.diagnosis_count if usage_row else 0,
    }

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    return UsageResponse(
        plan=plan,
        year_month=year_month,
        usage=usage,
        limits=limits,
    )
