from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.user_service import get_user_by_id

PLAN_PRICES: dict[str, int] = {
    "free": 0,
    "basic": 9900,
    "pro": 29900,
}

PLAN_FEATURES: dict[str, list[str]] = {
    "free": [
        "월 research 3회",
        "논문 수집 (arXiv·SS)",
        "기본 검색",
    ],
    "basic": [
        "월 research 30회",
        "설문문항 자동 생성",
        "논문 버전 관리",
        "Claude 요약",
    ],
    "pro": [
        "research 무제한",
        "논문 건강검진",
        "AI 연구 노트",
        "공유 카드 생성",
        "우선 지원",
    ],
}


def get_plan_price(plan: str) -> int:
    return PLAN_PRICES.get(plan, 0)


async def upgrade_plan(
    user_id: str,
    plan: str,
    db: AsyncSession,
    months: int = 1,
) -> dict:
    """
    플랜 업그레이드 — plan_expires_at = now + 30*months days.
    반환: {user_id, plan, plan_expires_at, amount_charged}
    """
    if plan not in PLAN_PRICES:
        raise ValueError(f"Unknown plan: {plan}")

    user = await get_user_by_id(user_id, db)
    if not user:
        raise ValueError(f"User {user_id} not found")

    expires_at = datetime.now(timezone.utc) + timedelta(days=30 * months)
    user.plan = plan
    user.plan_expires_at = expires_at
    await db.commit()
    await db.refresh(user)

    return {
        "user_id": user_id,
        "plan": plan,
        "plan_expires_at": expires_at.isoformat(),
        "amount_charged": get_plan_price(plan) * months,
    }


async def downgrade_to_free(user_id: str, db: AsyncSession) -> dict:
    """plan='free', plan_expires_at=None으로 되돌리기."""
    user = await get_user_by_id(user_id, db)
    if not user:
        raise ValueError(f"User {user_id} not found")

    user.plan = "free"
    user.plan_expires_at = None
    await db.commit()
    await db.refresh(user)

    return {"user_id": user_id, "plan": "free", "plan_expires_at": None}


async def check_plan_expired(user_id: str, db: AsyncSession) -> bool:
    """
    만료 여부 확인. 만료됐으면 free로 다운그레이드 후 True 반환.
    """
    user = await get_user_by_id(user_id, db)
    if not user or not user.plan_expires_at:
        return False

    now = datetime.now(timezone.utc)
    if user.plan != "free" and user.plan_expires_at < now:
        await downgrade_to_free(user_id, db)
        return True

    return False
