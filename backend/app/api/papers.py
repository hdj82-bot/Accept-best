from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.schemas.paper import (
    PaperListResponse,
    PaperRead,
    PaperSearchRequest,
    PaperSearchResponse,
)
from app.services.paper_service import get_paper, list_papers

router = APIRouter(prefix="/papers", tags=["papers"])


@router.get("/search")
async def search_papers_get(
    keyword: str = Query(..., min_length=1),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """키워드로 논문을 수집하고 결과를 반환한다."""
    from app.tasks.collect import collect_papers

    # 동기 실행으로 논문 수집
    try:
        collect_papers(keyword, "all", per_page)
    except Exception:
        pass  # 수집 실패해도 기존 DB 결과 반환

    # DB에서 결과 조회
    offset = (page - 1) * per_page
    papers, total = await list_papers(limit=per_page, offset=offset)
    return {
        "papers": [PaperRead.model_validate(p.__dict__) for p in papers],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/search", response_model=PaperSearchResponse)
async def search_papers(
    req: PaperSearchRequest,
    user_id: str = Depends(get_current_user),
):
    """키워드로 논문 수집 태스크를 트리거한다."""
    from app.tasks.collect import collect_papers

    try:
        from app.tasks import celery_app
        task = celery_app.send_task(
            "app.tasks.collect.collect_papers",
            args=[req.keyword, req.source, req.max_results],
            queue="collect",
        )
        task_id = task.id
    except Exception:
        collect_papers(req.keyword, req.source, req.max_results)
        task_id = "sync-execution"

    return PaperSearchResponse(
        task_id=task_id,
        message=f"수집 태스크가 시작되었습니다. 키워드: {req.keyword}",
        keyword=req.keyword,
        source=req.source,
    )


@router.get("", response_model=PaperListResponse)
async def read_papers(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """저장된 논문 목록을 조회한다."""
    papers, total = await list_papers(limit=limit, offset=offset)
    return PaperListResponse(
        papers=[PaperRead.model_validate(p.__dict__) for p in papers],
        total=total,
    )


@router.get("/{paper_id}", response_model=PaperRead)
async def read_paper(
    paper_id: str,
    user_id: str = Depends(get_current_user),
):
    """논문 상세 정보를 조회한다."""
    paper = await get_paper(paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")
    return PaperRead.model_validate(paper.__dict__)
