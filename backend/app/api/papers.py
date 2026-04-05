from __future__ import annotations

import logging
import uuid
from typing import List, Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.metrics import paper_search_total
from app.models.bookmark import Bookmark
from app.models.collection import PaperTag
from app.models.papers import Paper
from app.models.search_history import SearchHistory, SEARCH_HISTORY_LIMIT
from app.models.survey_questions import SurveyQuestion
from app.schemas.papers import PaperRead
from app.schemas.survey_questions import SurveyQuestionRead
from app.services import paper_service
from app.services.embedding_service import get_embedding
from app.services import search_service
from app.services import rerank_service

router = APIRouter()
settings = get_settings()


class PaperSearchRead(PaperRead):
    is_bookmarked: bool = False
    user_tags: List[str] = []


class SearchBody(BaseModel):
    query: str
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    source: Optional[str] = None  # 'arxiv' | 'semantic_scholar'
    hybrid: bool = True
    rerank: bool = False


class CollectBody(BaseModel):
    query: str
    source: str


class PaperSearchRerankRead(PaperSearchRead):
    rerank_score: Optional[float] = None
    rerank_reason: Optional[str] = None


@router.post("/papers/search")
async def search_papers(
    body: SearchBody,
    user_id: Optional[str] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── rerank plan gate ──────────────────────────────────────────────────────
    if body.rerank:
        if not user_id:
            raise HTTPException(status_code=403, detail="rerank 기능은 pro 플랜 전용입니다")
        from app.services.user_service import get_user_plan_cached  # noqa: PLC0415
        plan = await get_user_plan_cached(user_id, db)
        if plan != "pro":
            raise HTTPException(status_code=403, detail="rerank 기능은 pro 플랜 전용입니다")

    paper_search_total.labels(source=body.source or "all").inc()
    embedding = get_embedding(body.query)

    search_limit = 20 if body.rerank else 10

    if body.hybrid:
        raw_results = await search_service.search_papers_hybrid(
            query=body.query,
            query_embedding=embedding,
            db=db,
            limit=search_limit,
            year_from=body.year_from,
            year_to=body.year_to,
            source=body.source,
            alpha=0.7,
        )
        # raw_results is list[dict]; convert to Paper objects for uniform handling
        papers = [Paper(**{k: v for k, v in r.items() if k != "score"}) for r in raw_results]
    else:
        papers = await search_service.search_papers_filtered(
            embedding,
            db,
            limit=search_limit,
            year_from=body.year_from,
            year_to=body.year_to,
            source=body.source,
            query_text=body.query,
        )

    # ── rerank via Claude Haiku ───────────────────────────────────────────────
    rerank_scores: dict[str, tuple[float, str]] = {}
    if body.rerank and papers:
        candidates_as_dicts = [
            {
                "id": str(p.id),
                "title": p.title,
                "abstract": p.abstract,
                "year": p.year,
                "source": p.source,
            }
            for p in papers
        ]
        reranked = await rerank_service.rerank_papers(
            query=body.query,
            papers=candidates_as_dicts,
            top_k=10,
        )
        # Build score map and reorder papers according to reranked order
        rerank_scores = {
            r["id"]: (r.get("rerank_score", 0.0), r.get("rerank_reason", ""))
            for r in reranked
        }
        # Reorder papers to match reranked order
        reranked_ids = [r["id"] for r in reranked]
        paper_map = {str(p.id): p for p in papers}
        papers = [paper_map[pid] for pid in reranked_ids if pid in paper_map]

    # ── is_bookmarked + user_tags 필드 ───────────────────────────────────────
    bookmarked_ids: set[uuid.UUID] = set()
    tags_map: dict[uuid.UUID, list[str]] = {}
    if user_id and papers:
        paper_ids = [p.id for p in papers]
        bm_result = await db.execute(
            select(Bookmark.paper_id).where(
                Bookmark.user_id == uuid.UUID(user_id),
                Bookmark.paper_id.in_(paper_ids),
            )
        )
        bookmarked_ids = {row[0] for row in bm_result.fetchall()}

        # 논문별 태그 일괄 조회
        tag_result = await db.execute(
            select(PaperTag.paper_id, PaperTag.tag).where(
                PaperTag.user_id == uuid.UUID(user_id),
                PaperTag.paper_id.in_(paper_ids),
            ).order_by(PaperTag.tag)
        )
        for row in tag_result.fetchall():
            tags_map.setdefault(row[0], []).append(row[1])

    results = []
    for p in papers:
        if body.rerank:
            data = PaperSearchRerankRead.model_validate(p)
            pid_str = str(p.id)
            if pid_str in rerank_scores:
                data.rerank_score, data.rerank_reason = rerank_scores[pid_str]
        else:
            data = PaperSearchRead.model_validate(p)
        data.is_bookmarked = p.id in bookmarked_ids
        data.user_tags = tags_map.get(p.id, [])
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


@router.get("/papers/{paper_id}")
async def get_paper(
    paper_id: str,
    user_id: Optional[str] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    paper = await paper_service.get_paper(paper_id, db)
    if paper is None:
        raise NotFoundError("paper")

    # ── survey_questions for this paper / current user ────────────────────────
    survey_questions: list[dict] = []
    if user_id:
        sq_result = await db.execute(
            select(SurveyQuestion).where(
                SurveyQuestion.paper_id == paper.id,
                SurveyQuestion.user_id == uuid.UUID(user_id),
            )
        )
        sq_rows = sq_result.scalars().all()
        survey_questions = [SurveyQuestionRead.model_validate(sq).model_dump() for sq in sq_rows]

    # ── related_papers: top 3 similar papers via embedding (exclude self) ─────
    related_papers: list[dict] = []
    if paper.embedding is not None:
        try:
            related_sql = text(
                """
                SELECT * FROM papers
                WHERE id != CAST(:paper_id AS uuid)
                ORDER BY embedding <=> CAST(:vec AS vector)
                LIMIT 3
                """
            )
            rel_result = await db.execute(
                related_sql,
                {"paper_id": str(paper.id), "vec": str(list(paper.embedding))},
            )
            for row in rel_result.mappings().all():
                p_dict = {k: v for k, v in row.items()}
                related_papers.append(PaperRead.model_validate(p_dict).model_dump())
        except Exception as exc:
            logger.warning("related_papers query failed: %s", exc)

    paper_data = PaperRead.model_validate(paper).model_dump()
    return {
        "paper": paper_data,
        "survey_questions": survey_questions,
        "related_papers": related_papers,
        "is_bookmarked": False,
    }


@router.post("/papers/collect")
async def collect_papers(
    body: CollectBody,
    user_id: str = Depends(get_current_user),
):
    from app.tasks.collect import collect_arxiv_papers, collect_semantic_scholar_papers

    if body.source == "arxiv":
        task = collect_arxiv_papers.apply_async(args=[body.query])
    elif body.source == "semantic_scholar":
        task = collect_semantic_scholar_papers.apply_async(args=[body.query])
    else:
        task = collect_arxiv_papers.apply_async(args=[body.query])

    return {"task_id": task.id, "source": body.source}
