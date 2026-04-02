from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.share_token import ShareToken
from app.models.research_notes import ResearchNote


async def create_share_token(
    note_id: str,
    user_id: str,
    db: AsyncSession,
    expires_in_days: Optional[int] = None,
) -> ShareToken:
    token_str = secrets.token_urlsafe(32)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        if expires_in_days is not None
        else None
    )
    share = ShareToken(
        note_id=uuid.UUID(note_id),
        created_by=uuid.UUID(user_id),
        token=token_str,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


async def get_shared_note(
    token: str, db: AsyncSession
) -> Optional[ResearchNote]:
    """
    Validate token and return the associated ResearchNote.
    Returns None if token is missing, inactive, or expired.
    """
    result = await db.execute(
        select(ShareToken).where(
            ShareToken.token == token,
            ShareToken.is_active.is_(True),
        )
    )
    share = result.scalar_one_or_none()
    if share is None:
        return None

    if share.expires_at is not None and share.expires_at < datetime.now(timezone.utc):
        return None

    note_result = await db.execute(
        select(ResearchNote).where(ResearchNote.id == share.note_id)
    )
    return note_result.scalar_one_or_none()


async def revoke_token(
    token: str, user_id: str, db: AsyncSession
) -> bool:
    """Set is_active=False. Returns False if not found or not owned by user."""
    result = await db.execute(
        select(ShareToken).where(
            ShareToken.token == token,
            ShareToken.created_by == uuid.UUID(user_id),
        )
    )
    share = result.scalar_one_or_none()
    if share is None:
        return False

    share.is_active = False
    await db.commit()
    return True


async def list_user_tokens(user_id: str, db: AsyncSession) -> list[ShareToken]:
    result = await db.execute(
        select(ShareToken)
        .where(ShareToken.created_by == uuid.UUID(user_id))
        .order_by(ShareToken.created_at.desc())
    )
    return list(result.scalars().all())
