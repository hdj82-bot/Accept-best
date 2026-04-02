import os
from functools import wraps
from typing import Callable

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import QuotaExceededError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

ALGORITHM = "HS256"
PLAN_ORDER = {"free": 0, "basic": 1, "pro": 2}


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> str:
    """next-auth가 발급한 JWT에서 user_id(sub)를 추출한다.
    FastAPI는 서명 검증만 수행하고 DB 조회는 하지 않는다."""
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.NEXTAUTH_SECRET, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def plan_required(min_plan: str) -> Callable:
    """최소 플랜 등급을 요구하는 의존성 데코레이터.
    get_current_user로 user_id를 얻은 뒤 DB에서 플랜을 조회한다."""

    async def dependency(user_id: str = Depends(get_current_user)):
        from app.services.user_service import get_user

        user = await get_user(user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        if PLAN_ORDER.get(user.plan, 0) < PLAN_ORDER.get(min_plan, 0):
            raise QuotaExceededError(min_plan)
        return user_id

    return Depends(dependency)
