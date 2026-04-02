import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.exceptions import UnauthorizedError, QuotaExceededError

SECRET_KEY = os.getenv("NEXTAUTH_SECRET", "")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> str:
    """
    Validate a JWT issued by next-auth and return the user_id (sub claim).
    FastAPI only verifies the signature — no DB round-trip.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def plan_required(min_plan: str):
    """
    Decorator factory that enforces a minimum subscription plan.
    Must be used AFTER @router.post / @router.get etc.
    """
    plan_order = {"free": 0, "basic": 1, "pro": 2}

    def decorator(func):
        async def wrapper(*args, user_id: str = Depends(get_current_user), **kwargs):
            # Lazy import to avoid circular deps; replace with DI session when ready
            from app.services.users import get_user  # noqa: PLC0415

            user = await get_user(user_id)
            if plan_order.get(user.plan, 0) < plan_order.get(min_plan, 0):
                raise QuotaExceededError(func.__name__)
            return await func(*args, user_id=user_id, **kwargs)

        wrapper.__name__ = func.__name__
        return wrapper

    return decorator
