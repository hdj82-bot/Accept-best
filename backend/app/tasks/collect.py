"""
Celery tasks for collecting papers from external APIs.

Queue: collect  (slow I/O-bound tasks — always include sleep(3) between API calls)
"""

import logging
from time import sleep

import arxiv
import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.core.exceptions import RateLimitError, ExternalAPIError
from app.tasks import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()

_engine = create_async_engine(settings.database_url, pool_pre_ping=True)
_SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)


def _run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _upsert_paper(session: AsyncSession, paper_data: dict) -> str | None:
    result = await session.execute(
        text("""
            INSERT INTO papers (id, source, source_id, title, abstract, authors, author_ids,
                                keywords, published_at, year, doi, url, pdf_url, citation_count,
                                created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                :source, :source_id, :title, :abstract, :authors, :author_ids,
                :keywords, :published_at, :year, :doi, :url, :pdf_url, :citation_count,
                now(), now()
            )
            ON CONFLICT (source, source_id) DO NOTHING
            RETURNING id
        """),
        paper_data,
    )
    row = result.fetchone()
    return str(row[0]) if row else None


@celery_app.task(
    name="app.tasks.collect.collect_arxiv_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_arxiv_papers(query: str, max_results: int = 10) -> list:
    logger.info("collect_arxiv_papers: query=%s max_results=%d", query, max_results)

    sleep(3)

    client = arxiv.Client()
    search = arxiv.Search(query=query, max_results=max_results)

    papers_data = []
    for result in client.results(search):
        arxiv_id = result.entry_id.split("/")[-1]
        papers_data.append({
            "source": "arxiv",
            "source_id": arxiv_id,
            "title": result.title,
            "abstract": result.summary,
            "authors": [str(a) for a in result.authors] if result.authors else None,
            "author_ids": None,
            "keywords": result.categories if result.categories else None,
            "published_at": result.published,
            "year": result.published.year if result.published else None,
            "doi": result.doi,
            "url": result.entry_id,
            "pdf_url": result.pdf_url,
            "citation_count": 0,
        })

    collected_ids = []

    async def _insert():
        async with _SessionLocal() as session:
            async with session.begin():
                for pd in papers_data:
                    paper_id = await _upsert_paper(session, pd)
                    if paper_id:
                        collected_ids.append(paper_id)

    _run_async(_insert())
    return collected_ids


@celery_app.task(
    name="app.tasks.collect.collect_semantic_scholar_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_semantic_scholar_papers(query: str, max_results: int = 10) -> list:
    logger.info("collect_semantic_scholar_papers: query=%s max_results=%d", query, max_results)

    sleep(3)

    headers = {}
    if settings.ss_api_key:
        headers["x-api-key"] = settings.ss_api_key

    resp = httpx.get(
        "https://api.semanticscholar.org/graph/v1/paper/search",
        params={
            "query": query,
            "limit": max_results,
            "fields": "paperId,title,abstract,authors,year,citationCount,externalIds,url",
        },
        headers=headers,
        timeout=30,
    )

    if resp.status_code == 429:
        raise RateLimitError("SemanticScholar")
    if resp.status_code != 200:
        raise ExternalAPIError("SemanticScholar", resp.text)

    data = resp.json().get("data", [])

    papers_data = []
    for item in data:
        author_names = [a.get("name", "") for a in item.get("authors", [])]
        author_ids = [a.get("authorId") for a in item.get("authors", []) if a.get("authorId")]
        external_ids = item.get("externalIds") or {}
        papers_data.append({
            "source": "semantic_scholar",
            "source_id": item["paperId"],
            "title": item.get("title", ""),
            "abstract": item.get("abstract"),
            "authors": author_names if author_names else None,
            "author_ids": author_ids if author_ids else None,
            "keywords": None,
            "published_at": None,
            "year": item.get("year"),
            "doi": external_ids.get("DOI"),
            "url": item.get("url"),
            "pdf_url": None,
            "citation_count": item.get("citationCount", 0),
        })

    collected_ids = []

    async def _insert():
        async with _SessionLocal() as session:
            async with session.begin():
                for pd in papers_data:
                    paper_id = await _upsert_paper(session, pd)
                    if paper_id:
                        collected_ids.append(paper_id)

    _run_async(_insert())
    return collected_ids
