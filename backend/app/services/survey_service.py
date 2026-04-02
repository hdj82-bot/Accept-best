from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.survey_questions import SurveyQuestion


async def create_question(
    user_id: str,
    paper_id: Optional[str],
    original_q: str,
    adapted_q: Optional[str],
    db: AsyncSession,
) -> SurveyQuestion:
    question = SurveyQuestion(
        user_id=uuid.UUID(user_id),
        paper_id=uuid.UUID(paper_id) if paper_id else None,
        original_q=original_q,
        adapted_q=adapted_q,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


async def list_questions(
    user_id: str,
    db: AsyncSession,
    paper_id: Optional[str] = None,
) -> list[SurveyQuestion]:
    stmt = select(SurveyQuestion).where(
        SurveyQuestion.user_id == uuid.UUID(user_id)
    )
    if paper_id:
        stmt = stmt.where(SurveyQuestion.paper_id == uuid.UUID(paper_id))
    stmt = stmt.order_by(SurveyQuestion.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_question(
    question_id: uuid.UUID,
    user_id: str,
    db: AsyncSession,
) -> bool:
    """삭제. 존재하지 않거나 본인 소유가 아니면 False 반환."""
    result = await db.execute(
        select(SurveyQuestion).where(
            SurveyQuestion.id == question_id,
            SurveyQuestion.user_id == uuid.UUID(user_id),
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        return False
    await db.delete(question)
    await db.commit()
    return True
