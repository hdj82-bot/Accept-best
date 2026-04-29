from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.survey import (
    SurveyFinalResponse,
    SurveyGenerateRequest,
    SurveyItem,
    SurveyListResponse,
    SurveyPreQuestionsResponse,
    SurveyRead,
)
from app.services.paper_service import get_paper
from app.services.survey_service import (
    generate_pre_questions,
    generate_survey_questions,
    get_survey_question,
    list_survey_questions,
)
from app.services.usage import check_quota, increment_usage

router = APIRouter(prefix="/survey", tags=["survey"])


@router.post("/generate")
async def generate_survey(
    req: SurveyGenerateRequest,
    stage: str = Query(default="pre", pattern="^(pre|final)$"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SurveyPreQuestionsResponse | SurveyFinalResponse:
    """소크라테스식 2단계 설문 생성.

    - stage=pre  : 사전 질문 3~5개를 즉시 반환 (DB 저장 없음, 사용량 미차감).
    - stage=final: user_answers를 컨텍스트로 5~15개 문항 생성·저장. 사용량 차감.
    """
    paper = await get_paper(req.paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")

    if stage == "pre":
        questions = await generate_pre_questions(
            paper.id, paper.title, paper.abstract
        )
        return SurveyPreQuestionsResponse(stage="pre", questions=questions)

    # stage == "final"
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    plan = user.plan if user else "free"
    await check_quota(user_id, "survey_count", plan, db)

    saved = await generate_survey_questions(
        paper_id=paper.id,
        title=paper.title,
        abstract=paper.abstract or "",
        user_id=user_id,
        db=db,
        user_answers=req.user_answers,
        variable=req.variable,
    )
    await increment_usage(user_id, "survey_count", db)

    items = [SurveyItem.model_validate(q.__dict__) for q in saved]
    return SurveyFinalResponse(stage="final", items=items)


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
        survey_questions=[SurveyRead.model_validate(q.__dict__) for q in questions],
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
