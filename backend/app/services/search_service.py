from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.papers import Paper
from app.services import cache_service

logger = logging.getLogger(__name__)


async def search_papers_filtered(
    query_embedding: list[float],
    db: AsyncSession,
    limit: int = 10,
    year_from: int | None = None,
    year_to: int | None = None,
    source: str | None = None,  # 'arxiv' | 'semantic_scholar'
    query_text: str = "",        # used for cache key only
) -> list[Paper]:
    cache_key = cache_service.search_cache_key(query_text, year_from, year_to, source)

    # ── Cache hit ─────────────────────────────────────────────────────────────
    cached = await cache_service.get(cache_key)
    if cached is not None:
        logger.debug("cache hit: %s", cache_key)
        return [Paper(**row) for row in cached]

    # ── DB query ──────────────────────────────────────────────────────────────
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

    # ── Cache store ───────────────────────────────────────────────────────────
    if papers:
        await cache_service.set(
            cache_key,
            [{k: v for k, v in row.items()} for row in rows],
            ttl=cache_service.TTL_SEARCH,
        )

    return papers


async def search_papers_hybrid(
    query: str,
    query_embedding: list[float],
    db: AsyncSession,
    limit: int = 10,
    year_from: int | None = None,
    year_to: int | None = None,
    source: str | None = None,
    alpha: float = 0.7,  # vector weight; keyword weight = 1 - alpha
) -> list[dict]:  # returns papers with score field
    """Hybrid vector + keyword search with reciprocal score fusion."""

    # ── Cache key & lookup ────────────────────────────────────────────────────
    cache_key = (
        f"hybrid:{hash(query)}:{hash(tuple(query_embedding[:5]))}:"
        f"{year_from}:{year_to}:{source}:{alpha}:{limit}"
    )
    try:
        cached = await cache_service.get(cache_key)
        if cached is not None:
            logger.debug("hybrid cache hit: %s", cache_key)
            return cached
    except Exception as exc:
        logger.warning("hybrid cache get error: %s", exc)

    limit_x3 = limit * 3

    # ── 1. Vector search ──────────────────────────────────────────────────────
    vector_sql = text(
        """
        SELECT *, (embedding <=> CAST(:vec AS vector)) AS cosine_distance
        FROM papers
        WHERE (:year_from IS NULL OR EXTRACT(YEAR FROM published_at) >= :year_from)
          AND (:year_to IS NULL OR EXTRACT(YEAR FROM published_at) <= :year_to)
          AND (:source IS NULL OR source = :source)
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :limit_x3
        """
    )
    vector_result = await db.execute(
        vector_sql,
        {
            "year_from": year_from,
            "year_to": year_to,
            "source": source,
            "vec": str(query_embedding),
            "limit_x3": limit_x3,
        },
    )
    vector_rows = vector_result.mappings().all()

    # Build vector scores map: paper_id -> (row_dict, vector_score)
    vector_map: dict = {}
    for row in vector_rows:
        row_dict = {k: v for k, v in row.items() if k != "cosine_distance"}
        cosine_dist = row.get("cosine_distance") or 0.0
        vector_score = 1.0 - (float(cosine_dist) / 2.0)
        vector_map[str(row["id"])] = (row_dict, vector_score)

    # ── 2. Keyword search ─────────────────────────────────────────────────────
    keyword_sql = text(
        """
        SELECT id, title, abstract FROM papers
        WHERE (title ILIKE :pattern OR abstract ILIKE :pattern)
          AND (:year_from IS NULL OR EXTRACT(YEAR FROM published_at) >= :year_from)
          AND (:year_to IS NULL OR EXTRACT(YEAR FROM published_at) <= :year_to)
          AND (:source IS NULL OR source = :source)
        LIMIT :limit_x3
        """
    )
    keyword_result = await db.execute(
        keyword_sql,
        {
            "pattern": f"%{query}%",
            "year_from": year_from,
            "year_to": year_to,
            "source": source,
            "limit_x3": limit_x3,
        },
    )
    keyword_rows = keyword_result.mappings().all()

    # Build keyword scores map: paper_id -> keyword_score
    query_lower = query.lower()
    keyword_score_map: dict[str, float] = {}
    for row in keyword_rows:
        title = (row.get("title") or "").lower()
        kw_score = 1.0 if query_lower in title else 0.5
        keyword_score_map[str(row["id"])] = kw_score

    # ── 3. Merge & score fusion ────────────────────────────────────────────────
    # Collect all paper ids from both result sets
    all_ids = set(vector_map.keys()) | set(keyword_score_map.keys())

    # We need full row dicts for keyword-only results — fetch them
    keyword_only_ids = set(keyword_score_map.keys()) - set(vector_map.keys())
    extra_rows_map: dict[str, dict] = {}
    if keyword_only_ids:
        # Convert to list for the IN clause
        id_list = list(keyword_only_ids)
        extra_sql = text(
            "SELECT * FROM papers WHERE id = ANY(CAST(:ids AS uuid[]))"
        )
        try:
            extra_result = await db.execute(extra_sql, {"ids": id_list})
            for row in extra_result.mappings().all():
                extra_rows_map[str(row["id"])] = {k: v for k, v in row.items()}
        except Exception:
            # Fallback for DBs that don't support ANY (e.g., SQLite in tests)
            for pid in id_list:
                fallback_sql = text("SELECT * FROM papers WHERE CAST(id AS TEXT) = :pid")
                try:
                    fr = await db.execute(fallback_sql, {"pid": pid})
                    frow = fr.mappings().first()
                    if frow:
                        extra_rows_map[pid] = {k: v for k, v in frow.items()}
                except Exception:
                    pass

    merged: list[dict] = []
    for paper_id in all_ids:
        v_score = 0.0
        k_score = 0.0
        row_dict: dict | None = None

        if paper_id in vector_map:
            row_dict, v_score = vector_map[paper_id]
        if paper_id in keyword_score_map:
            k_score = keyword_score_map[paper_id]
        if row_dict is None and paper_id in extra_rows_map:
            row_dict = extra_rows_map[paper_id]

        if row_dict is None:
            continue

        final_score = alpha * v_score + (1.0 - alpha) * k_score
        entry = dict(row_dict)
        entry["score"] = final_score
        merged.append(entry)

    # ── 4. Sort & trim ────────────────────────────────────────────────────────
    merged.sort(key=lambda x: x["score"], reverse=True)
    results = merged[:limit]

    # ── 5. Cache store ────────────────────────────────────────────────────────
    if results:
        try:
            await cache_service.set(cache_key, results, ttl=300)
        except Exception as exc:
            logger.warning("hybrid cache set error: %s", exc)

    return results
