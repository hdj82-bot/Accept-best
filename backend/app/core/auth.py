import os
from functools import wraps

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import QuotaExceededError
from app.models.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

SECRET_KEY = settings.NEXTAUTH_SECRET


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def plan_required(min_plan: str):
    plan_order = {"free": 0, "basic": 1, "pro": 2}

    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            user_id: str = Depends(get_current_user),
            db: AsyncSession = Depends(get_db),
            **kwargs,
        ):
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if not user or plan_order.get(user.plan, 0) < plan_order[min_plan]:
                raise QuotaExceededError(func.__name__)
            return await func(*args, user_id=user_id, db=db, **kwargs)

        return wrapper

    return decorator
