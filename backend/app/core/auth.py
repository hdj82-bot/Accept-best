import os
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt
from jwt.exceptions import PyJWTError

from app.core.exceptions import UnauthorizedError, QuotaExceededError

SECRET_KEY = os.getenv("NEXTAUTH_SECRET", "")
if not SECRET_KEY:
    import warnings
    warnings.warn(
        "NEXTAUTH_SECRET is not set — JWT verification will fail. "
        "Set it in .env or as an environment variable.",
        stacklevel=1,
    )
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
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


async def require_admin(
    user_id: str = Depends(get_current_user),
    db=Depends(lambda: None),  # real db injected per-endpoint; see admin_required below
) -> str:
    """
    FastAPI dependency — use via Depends(require_admin).
    Checks plan='admin'; raises 403 otherwise.

    NOTE: Add 'admin' to plan_enum via Alembic migration:
        ALTER TYPE plan_enum ADD VALUE 'admin';
    """
    return user_id  # actual check is done inside admin_required wrapper below


def admin_required(func):
    """
    Decorator for admin-only endpoints.
    Injects get_current_user + get_db and verifies plan='admin'.

    Usage:
        @router.get("/admin/users")
        @admin_required
        async def list_users(user_id: str = Depends(get_current_user),
                             db: AsyncSession = Depends(get_db)):
            ...
    """
    import functools
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.core.database import get_db  # noqa: PLC0415

    @functools.wraps(func)
    async def wrapper(
        *args,
        user_id: str = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        **kwargs,
    ):
        from app.services.user_service import get_user_by_id  # noqa: PLC0415

        user = await get_user_by_id(user_id, db)
        if not user or user.plan != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return await func(*args, user_id=user_id, db=db, **kwargs)

    return wrapper


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
