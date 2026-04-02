from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.schemas.survey_questions import SurveyQuestionRead
from app.services.survey_service import (
    create_question,
    list_questions,
    delete_question,
)

router = APIRouter(prefix="/survey", tags=["survey"])


class SurveyCreateBody(BaseModel):
    paper_id: Optional[uuid.UUID] = None
    original_q: str
    adapted_q: Optional[str] = None


@router.get("/", response_model=List[SurveyQuestionRead])
async def list_my_questions(
    paper_id: Optional[uuid.UUID] = Query(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 질문 목록. paper_id 쿼리 파라미터로 필터링 가능."""
    return await list_questions(
        user_id,
        db,
        paper_id=str(paper_id) if paper_id else None,
    )


@router.post("/", response_model=SurveyQuestionRead, status_code=201)
async def create_survey_question(
    body: SurveyCreateBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """설문 질문 직접 생성."""
    return await create_question(
        user_id=user_id,
        paper_id=str(body.paper_id) if body.paper_id else None,
        original_q=body.original_q,
        adapted_q=body.adapted_q,
        db=db,
    )


@router.delete("/{question_id}", status_code=204)
async def delete_survey_question(
    question_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """삭제 — 본인 질문만."""
    deleted = await delete_question(question_id, user_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Survey question not found")


@router.post("/generate/{paper_id}")
async def generate_survey_questions(
    paper_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    # plan_required("basic") 적용 위치 — basic 이상만 생성 가능
):
    """
    paper_id에 대한 설문 질문 자동 생성 태스크를 Celery에 비동기 실행.
    결과는 태스크 완료 후 survey_questions 테이블에 저장됨.
    """
    from app.tasks.process import generate_survey_questions as celery_task

    task = celery_task.delay(user_id=user_id, paper_id=str(paper_id))
    return {"task_id": task.id, "status": "queued", "paper_id": str(paper_id)}
