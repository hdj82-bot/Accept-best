from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.users import User


async def get_or_create_user(
    email: str,
    provider: str,
    db: AsyncSession,
    name: Optional[str] = None,
    image: Optional[str] = None,
    provider_account_id: Optional[str] = None,
) -> User:
    """
    Upsert a user by email + provider.
    Creates a new row if none exists; returns the existing row otherwise.
    """
    stmt = (
        insert(User)
        .values(
            id=uuid.uuid4(),
            email=email,
            provider=provider,
            name=name,
            image=image,
            provider_account_id=provider_account_id,
        )
        .on_conflict_do_update(
            index_elements=["email"],
            set_={
                "name": name,
                "image": image,
                "provider_account_id": provider_account_id,
                "updated_at": datetime.utcnow(),
            },
        )
        .returning(User)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()


async def get_user_by_id(user_id: str, db: AsyncSession) -> Optional[User]:
    """Fetch a User by UUID string. Returns None if not found."""
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    return result.scalar_one_or_none()


async def update_plan(
    user_id: str,
    plan: str,
    expires_at: Optional[datetime],
    db: AsyncSession,
) -> Optional[User]:
    """Update a user's plan and expiry. Returns the updated User or None."""
    user = await get_user_by_id(user_id, db)
    if not user:
        return None
    user.plan = plan
    user.plan_expires_at = expires_at
    await db.commit()
    await db.refresh(user)
    return user
