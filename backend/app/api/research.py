from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
# plan_required 사용 위치: 예) @plan_required("basic") 을 엔드포인트 위에 추가
from app.core.database import get_db
from app.core.exceptions import QuotaExceededError
from app.models.research_notes import ResearchNote
from app.schemas.research_notes import ResearchNoteCreate, ResearchNoteRead, ResearchNoteUpdate
from app.services.user_service import get_user_by_id
from app.services.usage_service import increment_usage, get_current_month_usage

router = APIRouter(prefix="/research", tags=["research"])

# 플랜별 월 research 한도
PLAN_LIMITS = {"free": 3, "basic": 30, "pro": None}  # None = 무제한


@router.post("/start")
async def start_research(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    research 세션 시작 — monthly_usage.research_count +1.
    무료: 월 3회, basic: 월 30회, pro: 무제한.
    # plan_required("basic") 적용 시 basic 이상만 접근 가능
    """
    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    limit = PLAN_LIMITS.get(user.plan)
    if limit is not None:
        current = await get_current_month_usage(user_id, db)
        if current >= limit:
            raise QuotaExceededError(f"research ({user.plan} plan: {limit}/month)")

    new_count = await increment_usage(user_id, db)
    return {"started": True, "research_count_this_month": new_count}


@router.get("/", response_model=List[ResearchNoteRead])
async def list_research_notes(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 유저의 research_notes 목록."""
    result = await db.execute(
        select(ResearchNote)
        .where(ResearchNote.user_id == uuid.UUID(user_id))
        .order_by(ResearchNote.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/", response_model=ResearchNoteRead, status_code=201)
async def create_research_note(
    body: ResearchNoteCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """research_notes 생성."""
    note = ResearchNote(
        user_id=uuid.UUID(user_id),
        content=body.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/{note_id}", response_model=ResearchNoteRead)
async def get_research_note(
    note_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """단건 조회 — 본인 노트만."""
    result = await db.execute(
        select(ResearchNote).where(
            ResearchNote.id == note_id,
            ResearchNote.user_id == uuid.UUID(user_id),
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Research note not found")
    return note


@router.delete("/{note_id}", status_code=204)
async def delete_research_note(
    note_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """삭제 — 본인 노트만."""
    result = await db.execute(
        select(ResearchNote).where(
            ResearchNote.id == note_id,
            ResearchNote.user_id == uuid.UUID(user_id),
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Research note not found")
    await db.delete(note)
    await db.commit()
