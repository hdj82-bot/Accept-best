from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.schemas.reference import (
    ReferenceCreate,
    ReferenceListResponse,
    ReferenceRead,
    ReferenceUpdate,
)
from app.services.paper_service import get_paper
from app.services.reference_service import (
    create_reference,
    delete_reference,
    get_reference,
    list_references,
    update_reference,
)
from app.services.usage import check_quota, increment_usage
from app.services.user_service import get_user

router = APIRouter(prefix="/references", tags=["references"])


class ExtractRequest(BaseModel):
    paper_id: str


@router.post("", response_model=ReferenceRead)
async def add_reference(
    req: ReferenceCreate,
    user_id: str = Depends(get_current_user),
):
    """참고문헌을 등록한다."""
    ref = await create_reference(req, user_id)
    return ReferenceRead.model_validate(ref.__dict__)


@router.get("", response_model=ReferenceListResponse)
async def read_references(
    paper_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    """참고문헌 목록을 조회한다."""
    refs, total = await list_references(
        paper_id=paper_id, limit=limit, offset=offset,
    )
    return ReferenceListResponse(
        references=[ReferenceRead.model_validate(r.__dict__) for r in refs],
        total=total,
    )


@router.get("/{ref_id}", response_model=ReferenceRead)
async def read_reference(
    ref_id: str,
    user_id: str = Depends(get_current_user),
):
    """참고문헌 상세 정보를 조회한다."""
    ref = await get_reference(ref_id)
    if ref is None:
        raise HTTPException(status_code=404, detail="Reference not found")
    return ReferenceRead.model_validate(ref.__dict__)


@router.put("/{ref_id}", response_model=ReferenceRead)
async def edit_reference(
    ref_id: str,
    req: ReferenceUpdate,
    user_id: str = Depends(get_current_user),
):
    """참고문헌을 수정한다."""
    ref = await update_reference(ref_id, req)
    if ref is None:
        raise HTTPException(status_code=404, detail="Reference not found")
    return ReferenceRead.model_validate(ref.__dict__)


@router.delete("/{ref_id}")
async def remove_reference(
    ref_id: str,
    user_id: str = Depends(get_current_user),
):
    """참고문헌을 삭제한다."""
    ref = await get_reference(ref_id)
    if ref is None:
        raise HTTPException(status_code=404, detail="Reference not found")
    await delete_reference(ref_id)
    return {"message": "삭제되었습니다"}


@router.post("/extract")
async def extract_references(
    req: ExtractRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """논문에서 참고문헌을 자동 추출하는 태스크를 트리거한다."""
    # 논문 존재 확인
    paper = await get_paper(req.paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 사용량 체크
    user = await get_user(user_id)
    plan = user.plan if user else "free"
    await check_quota(user_id, "research_count", plan, db)

    # Celery 태스크 제출
    try:
        from app.tasks import celery_app

        task = celery_app.send_task(
            "app.tasks.process.extract_references",
            args=[user_id, req.paper_id],
            queue="process",
        )
        task_id = task.id
    except Exception:
        task_id = "sync-execution"

    # 사용량 증가
    await increment_usage(user_id, "research_count", db)

    return {
        "task_id": task_id,
        "message": "참고문헌 추출 태스크가 시작되었습니다.",
    }
