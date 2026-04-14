from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.survey import (
    SurveyGenerateRequest,
    SurveyGenerateResponse,
    SurveyListResponse,
    SurveyRead,
)
from app.services.paper_service import get_paper
from app.services.survey_service import get_survey_question, list_survey_questions
from app.services.usage import check_quota, increment_usage

router = APIRouter(prefix="/survey", tags=["survey"])


@router.post("/generate", response_model=SurveyGenerateResponse)
async def generate_survey(
    req: SurveyGenerateRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """논문 기반 설문문항 자동생성 태스크를 트리거한다."""
    # 논문 존재 확인
    paper = await get_paper(req.paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 사용량 체크
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    plan = user.plan if user else "free"
    await check_quota(user_id, "survey_count", plan, db)

    # Celery 태스크 제출
    try:
        from app.tasks import celery_app

        task = celery_app.send_task(
            "app.tasks.process.generate_survey",
            args=[req.paper_id, user_id],
            queue="process",
        )
        task_id = task.id
    except Exception:
        task_id = "sync-execution"

    # 사용량 증가
    await increment_usage(user_id, "survey_count", db)

    return SurveyGenerateResponse(
        task_id=task_id,
        message="설문문항 생성 태스크가 시작되었습니다.",
    )


@router.get("", response_model=SurveyListResponse)
async def read_surveys(
    paper_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    """설문문항 목록을 조회한다."""
    questions, total = await list_survey_questions(
        paper_id=paper_id, limit=limit, offset=offset,
    )
    return SurveyListResponse(
        questions=[SurveyRead.model_validate(q.__dict__) for q in questions],
        total=total,
    )


@router.get("/{survey_id}", response_model=SurveyRead)
async def read_survey(
    survey_id: str,
    user_id: str = Depends(get_current_user),
):
    """설문문항 상세 정보를 조회한다."""
    question = await get_survey_question(survey_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Survey question not found")
    return SurveyRead.model_validate(question.__dict__)
