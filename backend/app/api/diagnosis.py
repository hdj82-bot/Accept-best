from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.schemas.diagnosis import (
    DiagnoseRequest,
    DiagnoseResponse,
    DiagnosisListResponse,
    DiagnosisRead,
)
from app.services.diagnosis_service import get_diagnosis, list_diagnoses
from app.services.paper_service import get_paper
from app.services.usage import check_quota, increment_usage
from app.services.user_service import get_user

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


@router.post("/run", response_model=DiagnoseResponse)
async def run_diagnosis(
    req: DiagnoseRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """논문 건강검진 태스크를 트리거한다."""
    # 논문 존재 확인
    paper = await get_paper(req.paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 사용량 체크
    user = await get_user(user_id)
    plan = user.plan if user else "free"
    await check_quota(user_id, "healthcheck_count", plan, db)

    # Celery 태스크 제출
    try:
        from app.tasks import celery_app

        task = celery_app.send_task(
            "app.tasks.process.diagnose_paper",
            args=[user_id, req.paper_id],
            queue="process",
        )
        task_id = task.id
    except Exception:
        task_id = "sync-execution"

    # 사용량 증가
    await increment_usage(user_id, "healthcheck_count", db)

    return DiagnoseResponse(
        task_id=task_id,
        message="논문 건강검진 태스크가 시작되었습니다.",
    )


@router.get("", response_model=DiagnosisListResponse)
async def read_diagnoses(
    paper_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    """건강검진 결과 목록을 조회한다."""
    diagnoses, total = await list_diagnoses(
        paper_id=paper_id, limit=limit, offset=offset,
    )
    return DiagnosisListResponse(
        diagnoses=[DiagnosisRead.model_validate(d.__dict__) for d in diagnoses],
        total=total,
    )


@router.get("/{diagnosis_id}", response_model=DiagnosisRead)
async def read_diagnosis(
    diagnosis_id: str,
    user_id: str = Depends(get_current_user),
):
    """건강검진 상세 결과를 조회한다."""
    diagnosis = await get_diagnosis(diagnosis_id)
    if diagnosis is None:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return DiagnosisRead.model_validate(diagnosis.__dict__)
