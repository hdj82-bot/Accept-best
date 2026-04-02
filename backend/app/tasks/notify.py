"""
Celery tasks for email notifications.

Queue: process  (users may be waiting; keep fast)
"""
from __future__ import annotations

import logging
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.tasks import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()

_engine = create_async_engine(settings.database_url, pool_pre_ping=True)
_SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)


def _run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="app.tasks.notify.send_plan_expiry_warning",
    queue="process",
    max_retries=3,
)
def send_plan_expiry_warning(user_id: str) -> dict:
    logger.info("send_plan_expiry_warning: user_id=%s", user_id)

    async def _run():
        from app.models.users import User
        from app.services.email_service import send_email, render_plan_expiry_warning
        from datetime import datetime, timezone

        async with _SessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()

        if not user or not user.plan_expires_at:
            return {"skipped": True, "reason": "user not found or no expiry"}

        days_left = (user.plan_expires_at - datetime.now(timezone.utc)).days
        html = render_plan_expiry_warning(user.email, user.plan, days_left)
        send_email(
            to=user.email,
            subject=f"[academi.ai] {user.plan} 플랜이 {days_left}일 후 만료됩니다",
            html_body=html,
        )
        return {"sent": True, "to": user.email}

    return _run_async(_run())


@celery_app.task(
    name="app.tasks.notify.send_research_complete",
    queue="process",
    max_retries=3,
)
def send_research_complete(user_id: str, note_id: str, export_url: str) -> dict:
    logger.info(
        "send_research_complete: user_id=%s note_id=%s", user_id, note_id
    )

    async def _run():
        from app.models.users import User
        from app.models.research_notes import ResearchNote
        from app.services.email_service import send_email, render_research_complete

        async with _SessionLocal() as session:
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            note_result = await session.execute(
                select(ResearchNote).where(ResearchNote.id == note_id)
            )
            note = note_result.scalar_one_or_none()

        if not user or not note:
            return {"skipped": True, "reason": "user or note not found"}

        # ResearchNote has no title column — use first 40 chars of content
        note_title = (note.content or "")[:40].replace("\n", " ") + "…"
        html = render_research_complete(user.email, note_title, export_url)
        send_email(
            to=user.email,
            subject="[academi.ai] 연구 노트 내보내기가 완료되었습니다",
            html_body=html,
        )
        return {"sent": True, "to": user.email}

    return _run_async(_run())
