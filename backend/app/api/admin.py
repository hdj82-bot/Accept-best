import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, admin_required
from app.core.database import get_db
from app.models.users import User
from app.models.papers import Paper
from app.models.monthly_usage import MonthlyUsage
from app.services.usage_service import get_current_month_usage

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
@admin_required
async def list_users(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """전체 유저 목록 (email, plan, 이번 달 research 사용량)."""
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    year_month = datetime.now(timezone.utc).strftime("%Y-%m")
    usage_result = await db.execute(
        select(MonthlyUsage.user_id, MonthlyUsage.research_count).where(
            MonthlyUsage.year_month == year_month
        )
    )
    usage_map: dict = {str(row.user_id): row.research_count for row in usage_result}

    return [
        {
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "plan": u.plan,
            "plan_expires_at": u.plan_expires_at.isoformat() if u.plan_expires_at else None,
            "created_at": u.created_at.isoformat(),
            "current_month_research_count": usage_map.get(str(u.id), 0),
        }
        for u in users
    ]


@router.get("/stats")
@admin_required
async def get_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """총 유저 수, 플랜별 분포, 오늘 신규 가입, 총 논문 수."""
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar_one()

    plan_result = await db.execute(
        select(User.plan, func.count(User.id)).group_by(User.plan)
    )
    plan_dist = {row.plan: row[1] for row in plan_result}

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    new_today_result = await db.execute(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    new_today = new_today_result.scalar_one()

    total_papers_result = await db.execute(select(func.count(Paper.id)))
    total_papers = total_papers_result.scalar_one()

    return {
        "total_users": total_users,
        "plan_distribution": plan_dist,
        "new_users_today": new_today,
        "total_papers": total_papers,
    }


@router.get("/usage")
@admin_required
async def get_usage_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """최근 7일 일별 research_count 합계 (monthly_usage 기준 근사치)."""
    # monthly_usage는 월 단위이므로 현재 월 데이터에서 합산
    year_month = datetime.now(timezone.utc).strftime("%Y-%m")
    result = await db.execute(
        select(func.sum(MonthlyUsage.research_count)).where(
            MonthlyUsage.year_month == year_month
        )
    )
    monthly_total = result.scalar_one() or 0

    # 일별 데이터는 별도 테이블 없으므로 현재 월 합계를 반환
    # (daily_usage 테이블 추가 시 교체 예정)
    today = datetime.now(timezone.utc)
    return {
        "note": "daily breakdown requires a daily_usage table; returning current-month total",
        "year_month": year_month,
        "monthly_research_total": monthly_total,
        "generated_at": today.isoformat(),
    }


@router.delete("/users/{target_id}", status_code=204)
@admin_required
async def delete_user(
    target_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """유저 삭제 — 본인 삭제 불가."""
    if str(target_id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(target)
    await db.commit()
