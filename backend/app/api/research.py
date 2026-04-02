from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
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


@router.post("/{note_id}/checkup")
async def checkup_research_note(
    note_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    논문 건강검진 — pro 플랜 전용.
    노트 내용을 Claude로 분석해 구조·명료성·개선 제안을 반환.
    USE_FIXTURES=true 시 목업 결과 반환.
    """
    import os

    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.plan != "pro":
        raise HTTPException(status_code=403, detail="논문 건강검진은 pro 플랜 전용입니다.")

    result = await db.execute(
        select(ResearchNote).where(
            ResearchNote.id == note_id,
            ResearchNote.user_id == uuid.UUID(user_id),
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Research note not found")

    content = note.content or ""
    if isinstance(content, dict):
        content = str(content)

    if os.getenv("USE_FIXTURES", "false").lower() == "true" or not content.strip():
        return {
            "structure_score": 8,
            "clarity_score": 7,
            "originality_score": 6,
            "overall_score": 7,
            "summary": "연구 목적이 명확하게 제시되어 있습니다.",
            "suggestions": [
                "서론의 연구 배경을 좀 더 구체적으로 서술하면 좋겠습니다.",
                "결론 부분에서 한계점과 향후 연구 방향을 추가하세요.",
                "참고문헌 인용 형식을 통일해 주세요.",
            ],
            "strengths": [
                "연구 질문이 명확합니다.",
                "방법론 섹션이 잘 구성되어 있습니다.",
            ],
            "fixture": True,
        }

    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "다음 연구 노트를 분석하고 JSON으로 결과를 반환하세요.\n"
                        "형식: {structure_score(1-10), clarity_score(1-10), originality_score(1-10), "
                        "overall_score(1-10), summary(string), suggestions(list[string]), strengths(list[string])}\n\n"
                        f"노트 내용:\n{content[:3000]}"
                    ),
                }
            ],
        )
        import json

        text = message.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception:
        return {
            "structure_score": 5,
            "clarity_score": 5,
            "originality_score": 5,
            "overall_score": 5,
            "summary": "분석 중 오류가 발생했습니다.",
            "suggestions": ["다시 시도해 주세요."],
            "strengths": [],
        }


@router.post("/{note_id}/gap-analysis")
async def gap_analysis(
    note_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    연구 공백 발견 — pro 플랜 전용.
    note_id에 연결된 수집 논문들을 Claude로 분석.
    """
    user = await get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.plan != "pro":
        raise HTTPException(status_code=403, detail="연구 공백 발견은 pro 플랜 전용입니다.")

    from app.services.gap_service import analyze_research_gap

    return await analyze_research_gap(str(note_id), user_id, db)


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
