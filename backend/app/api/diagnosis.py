from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.schemas.diagnosis import (
    DialogAnswerRead,
    DiagnoseRequest,
    DiagnoseResponse,
    DiagnosisAnswerRequest,
    DiagnosisListResponse,
    DiagnosisRead,
)
from app.services.diagnosis_service import get_diagnosis, list_diagnoses
from app.services.dialog_log import log_dialog_answer
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
        paper_id=req.paper_id,
    )


@router.post("/answer", response_model=DialogAnswerRead)
async def submit_diagnosis_answer(
    req: DiagnosisAnswerRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """건강검진 결과의 되묻기 질문에 대한 연구자 답변을 누적 저장한다.

    소크라테스식 대화 정책 (academi.md "대화 정책") 의 데이터 활용 단계.
    저장된 답변은 (1) 본인의 다음 진단 컨텍스트, (2) 익명·집계 패턴 분석에 사용.
    """
    entry = await log_dialog_answer(
        user_id=user_id,
        service_name="diagnosis",
        context_id=req.context_id,
        question=req.question,
        answer=req.answer,
        db=db,
    )
    await db.commit()
    return DialogAnswerRead.model_validate(entry, from_attributes=True)


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
