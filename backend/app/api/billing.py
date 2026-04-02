from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.services.billing_service import (
    PLAN_PRICES,
    PLAN_FEATURES,
    upgrade_plan,
    downgrade_to_free,
    check_plan_expired,
)
from app.services.user_service import get_user_by_id
from app.services.usage_service import get_current_month_usage

router = APIRouter(prefix="/billing", tags=["billing"])


class UpgradeBody(BaseModel):
    plan: str
    months: int = Field(default=1, ge=1, le=12)


@router.get("/plans")
async def list_plans():
    """플랜 목록 + 가격 + 기능 비교."""
    return [
        {
            "plan": plan,
            "price_krw": PLAN_PRICES[plan],
            "features": PLAN_FEATURES[plan],
        }
        for plan in ("free", "basic", "pro")
    ]


@router.get("/current")
async def get_current_billing(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 플랜 + 만료일 + 이번 달 research 사용량."""
    await check_plan_expired(user_id, db)

    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    usage = await get_current_month_usage(user_id, db)

    return {
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "price_krw": PLAN_PRICES.get(user.plan, 0),
        "current_month_research_count": usage,
    }


@router.post("/upgrade")
async def upgrade(
    body: UpgradeBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    플랜 업그레이드 (mock 결제).
    실제 PG 연동 전까지 금액 검증 없이 즉시 플랜 적용.
    """
    if body.plan not in PLAN_PRICES or body.plan == "free":
        raise HTTPException(status_code=422, detail="Invalid plan. Choose 'basic' or 'pro'.")

    result = await upgrade_plan(user_id, body.plan, db, months=body.months)
    return {"status": "ok", **result}


@router.post("/cancel")
async def cancel_plan(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """구독 취소 → free 다운그레이드."""
    result = await downgrade_to_free(user_id, db)
    return {"status": "ok", **result}
