from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.paper import Paper
from app.schemas.paper import (
    CollectRequest,
    CollectResponse,
    PaperDetail,
    PaperRead,
    PaperSearchResponse,
    SimilarPaperItem,
    SimilarPaperResponse,
)
from app.schemas.summary import SummaryRead
from app.services.summary_service import summarize_paper as do_summarize
from app.tasks.collect import collect_papers

router = APIRouter(prefix="/papers", tags=["papers"])


@router.get("/search", response_model=PaperSearchResponse)
async def search_papers(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    where = Paper.title.ilike(pattern) | Paper.abstract.ilike(pattern)

    total_result = await db.execute(select(func.count(Paper.id)).where(where))
    total = total_result.scalar_one()

    offset = (page - 1) * size
    rows = await db.execute(
        select(Paper).where(where).order_by(Paper.created_at.desc()).offset(offset).limit(size)
    )
    papers = rows.scalars().all()

    return PaperSearchResponse(
        items=[PaperRead.model_validate(p) for p in papers],
        total=total,
        page=page,
        size=size,
    )


@router.get("/similar/{paper_id}", response_model=SimilarPaperResponse)
async def get_similar_papers(
    paper_id: str,
    limit: int = Query(10, ge=1, le=50),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Paper not found")
    if paper.embedding is None:
        return SimilarPaperResponse(paper_id=paper_id, items=[])

    stmt = (
        select(
            Paper,
            (1 - Paper.embedding.cosine_distance(paper.embedding)).label("score"),
        )
        .where(Paper.id != paper_id)
        .where(Paper.embedding.isnot(None))
        .order_by(Paper.embedding.cosine_distance(paper.embedding))
        .limit(limit)
    )
    rows = await db.execute(stmt)
    items = [
        SimilarPaperItem(paper=PaperRead.model_validate(row.Paper), score=round(row.score, 4))
        for row in rows
    ]

    return SimilarPaperResponse(paper_id=paper_id, items=items)


@router.get("/{paper_id}", response_model=PaperDetail)
async def get_paper(
    paper_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Paper not found")

    summary = None
    if paper.abstract:
        try:
            summary = await do_summarize(paper.id, paper.title, paper.abstract)
        except Exception:
            pass

    return PaperDetail(**PaperRead.model_validate(paper).model_dump(), summary=summary)


@router.post("/collect", response_model=CollectResponse)
async def trigger_collect(
    body: CollectRequest,
    user_id: str = Depends(get_current_user),
):
    task = collect_papers.delay(user_id, body.keyword)
    return CollectResponse(task_id=task.id, status="queued")
