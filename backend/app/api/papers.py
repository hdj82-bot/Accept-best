from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.metrics import paper_search_total
from app.models.bookmark import Bookmark
from app.models.papers import Paper
from app.models.search_history import SearchHistory, SEARCH_HISTORY_LIMIT
from app.schemas.papers import PaperRead
from app.services import paper_service
from app.services.embedding_service import get_embedding
from app.services import search_service

router = APIRouter()
settings = get_settings()


class PaperSearchRead(PaperRead):
    is_bookmarked: bool = False


class SearchBody(BaseModel):
    query: str
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    source: Optional[str] = None  # 'arxiv' | 'semantic_scholar'


class CollectBody(BaseModel):
    query: str
    source: str


@router.post("/papers/search", response_model=List[PaperSearchRead])
async def search_papers(
    body: SearchBody,
    user_id: Optional[str] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    paper_search_total.labels(source=body.source or "all").inc()
    embedding = get_embedding(body.query)
    papers = await search_service.search_papers_filtered(
        embedding,
        db,
        limit=10,
        year_from=body.year_from,
        year_to=body.year_to,
        source=body.source,
        query_text=body.query,
    )

    # ── is_bookmarked 필드 ────────────────────────────────────────────────────
    bookmarked_ids: set[uuid.UUID] = set()
    if user_id and papers:
        paper_ids = [p.id for p in papers]
        bm_result = await db.execute(
            select(Bookmark.paper_id).where(
                Bookmark.user_id == uuid.UUID(user_id),
                Bookmark.paper_id.in_(paper_ids),
            )
        )
        bookmarked_ids = {row[0] for row in bm_result.fetchall()}

    results = []
    for p in papers:
        data = PaperSearchRead.model_validate(p)
        data.is_bookmarked = p.id in bookmarked_ids
        results.append(data)

    # ── 검색 히스토리 저장 ────────────────────────────────────────────────────
    if user_id:
        history = SearchHistory(
            user_id=uuid.UUID(user_id),
            query=body.query,
            result_count=len(papers),
        )
        db.add(history)
        await db.flush()

        # 최근 20개 초과분 삭제
        subq = (
            select(SearchHistory.id)
            .where(SearchHistory.user_id == uuid.UUID(user_id))
            .order_by(SearchHistory.created_at.desc())
            .limit(SEARCH_HISTORY_LIMIT)
            .scalar_subquery()
        )
        await db.execute(
            delete(SearchHistory).where(
                SearchHistory.user_id == uuid.UUID(user_id),
                SearchHistory.id.not_in(subq),
            )
        )
        await db.commit()

    return results


@router.get("/papers/search/history")
async def get_search_history(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """최근 검색어 20개 반환."""
    result = await db.execute(
        select(SearchHistory)
        .where(SearchHistory.user_id == uuid.UUID(user_id))
        .order_by(SearchHistory.created_at.desc())
        .limit(SEARCH_HISTORY_LIMIT)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "query": r.query,
            "result_count": r.result_count,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/papers/{paper_id}", response_model=PaperRead)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await paper_service.get_paper(paper_id, db)
    if paper is None:
        raise NotFoundError("paper")
    return paper


@router.post("/papers/collect")
async def collect_papers(body: CollectBody):
    from app.tasks.collect import collect_arxiv_papers, collect_semantic_scholar_papers

    if body.source == "arxiv":
        task = collect_arxiv_papers.apply_async(args=[body.query])
    elif body.source == "semantic_scholar":
        task = collect_semantic_scholar_papers.apply_async(args=[body.query])
    else:
        task = collect_arxiv_papers.apply_async(args=[body.query])

    return {"task_id": task.id, "source": body.source}
