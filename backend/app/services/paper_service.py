from __future__ import annotations

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.papers import Paper


async def search_similar(
    query_embedding: list[float],
    db: AsyncSession,
    limit: int = 10,
) -> list[Paper]:
    result = await db.execute(
        text(
            "SELECT * FROM papers ORDER BY embedding <=> CAST(:vec AS vector) LIMIT :limit"
        ),
        {"vec": str(query_embedding), "limit": limit},
    )
    rows = result.mappings().all()
    papers = []
    for row in rows:
        paper = Paper(**{k: v for k, v in row.items()})
        papers.append(paper)
    return papers


async def get_paper(paper_id: str, db: AsyncSession) -> Paper | None:
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    return result.scalar_one_or_none()


def collect_and_process(query: str) -> dict:
    from app.tasks.collect import collect_arxiv_papers, collect_semantic_scholar_papers

    arxiv_task = collect_arxiv_papers.apply_async(args=[query])
    ss_task = collect_semantic_scholar_papers.apply_async(args=[query])

    return {
        "arxiv_task_id": arxiv_task.id,
        "semantic_scholar_task_id": ss_task.id,
    }
