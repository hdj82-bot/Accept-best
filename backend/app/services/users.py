"""User service — DB helpers for user lookup."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User


async def get_user(user_id: str, db: Optional[AsyncSession] = None) -> Optional[User]:
    """
    Fetch a User by ID. Returns None if not found.
    db is optional to allow stub usage during development.
    """
    if db is None:
        return None
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    return result.scalar_one_or_none()
