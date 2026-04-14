from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.schemas.reference import (
    ResearchGapRead,
    ResearchGapRequest,
    ResearchGapResponse,
)
from app.services.paper_service import get_paper
from app.services.usage import check_quota, increment_usage
from app.services.user_service import get_user

router = APIRouter(prefix="/research-gaps", tags=["research-gaps"])


@router.post("/analyze", response_model=ResearchGapResponse)
async def analyze_gaps(
    req: ResearchGapRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """복수 논문 간 연구 공백을 분석하는 태스크를 트리거한다."""
    # paper_ids 개수 검증 (스키마에서도 할 수 있지만 방어적으로)
    if not (2 <= len(req.paper_ids) <= 10):
        raise HTTPException(
            status_code=422,
            detail="paper_ids는 2~10개여야 합니다",
        )

    # 모든 논문 존재 확인
    for pid in req.paper_ids:
        paper = await get_paper(pid)
        if paper is None:
            raise HTTPException(
                status_code=404,
                detail=f"Paper not found: {pid}",
            )

    # 사용량 체크
    user = await get_user(user_id)
    plan = user.plan if user else "free"
    await check_quota(user_id, "research_count", plan, db)

    # Celery 태스크 제출
    try:
        from app.tasks import celery_app

        task = celery_app.send_task(
            "app.tasks.process.find_research_gaps",
            args=[user_id, req.paper_ids],
            queue="process",
        )
        task_id = task.id
    except Exception:
        task_id = "sync-execution"

    # 사용량 증가
    await increment_usage(user_id, "research_count", db)

    return ResearchGapResponse(
        task_id=task_id,
        message="연구 공백 분석 태스크가 시작되었습니다.",
    )


@router.get("/result/{task_id}")
async def get_gap_result(
    task_id: str,
    user_id: str = Depends(get_current_user),
):
    """연구 공백 분석 태스크 결과를 조회한다."""
    try:
        from app.tasks import celery_app

        result = celery_app.AsyncResult(task_id)
    except Exception:
        return {"status": "pending"}

    if result.ready():
        if result.successful():
            return ResearchGapRead.model_validate(result.result)
        return {"status": "failed", "detail": str(result.result)}

    return {"status": "pending"}
