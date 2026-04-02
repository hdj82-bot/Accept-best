from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.schemas.users import UserRead, UserUpdate
from app.schemas.monthly_usage import MonthlyUsageRead
from app.services.user_service import get_user_by_id
from app.services.usage_service import get_current_month_usage, get_usage_history

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 로그인 유저 정보 + 이번 달 research 사용량."""
    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # 이번 달 사용량은 응답 헤더 또는 별도 필드로 제공 (스키마 확장 전까지 헤더)
    usage = await get_current_month_usage(user_id, db)
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    data = jsonable_encoder(UserRead.model_validate(user))
    data["current_month_research_count"] = usage
    return data


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: UserUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """프로필 수정 — 이메일 제외 (name, image, plan, plan_expires_at)."""
    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/usage", response_model=List[MonthlyUsageRead])
async def get_my_usage(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """최근 6개월 monthly_usage 조회."""
    return await get_usage_history(user_id, db, months=6)
