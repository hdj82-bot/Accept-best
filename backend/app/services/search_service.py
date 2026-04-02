from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.papers import Paper


async def search_papers_filtered(
    query_embedding: list[float],
    db: AsyncSession,
    limit: int = 10,
    year_from: int | None = None,
    year_to: int | None = None,
    source: str | None = None,  # 'arxiv' | 'semantic_scholar'
) -> list[Paper]:
    sql = text(
        """
        SELECT * FROM papers
        WHERE (:year_from IS NULL OR EXTRACT(YEAR FROM published_at) >= :year_from)
          AND (:year_to IS NULL OR EXTRACT(YEAR FROM published_at) <= :year_to)
          AND (:source IS NULL OR source = :source)
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :limit
        """
    )

    result = await db.execute(
        sql,
        {
            "year_from": year_from,
            "year_to": year_to,
            "source": source,
            "vec": str(query_embedding),
            "limit": limit,
        },
    )
    rows = result.mappings().all()
    papers = [Paper(**{k: v for k, v in row.items()}) for row in rows]
    return papers
