"""논문 수집 태스크 — collect 큐에서 실행.
arXiv API와 Semantic Scholar API에서 논문을 검색하고 DB에 저장한다.
외부 API 호출 간 sleep(3)을 두어 rate limit을 준수한다."""

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.core.exceptions import ExternalAPIError, RateLimitError
from app.tasks import celery_app

logger = logging.getLogger(__name__)

ARXIV_API_URL = "http://export.arxiv.org/api/query"
SS_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"


def _run_async(coro):
    """Celery 워커(동기)에서 async 함수를 실행하는 헬퍼."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ─── arXiv 수집 ───────────────────────────────────────────


async def _fetch_arxiv(keyword: str, max_results: int = 10) -> list[dict]:
    """arXiv Atom API에서 논문을 검색한다."""
    params = {
        "search_query": f"all:{keyword}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(ARXIV_API_URL, params=params)
        if resp.status_code == 429:
            raise RateLimitError("arXiv")
        if resp.status_code != 200:
            raise ExternalAPIError("arXiv", f"status {resp.status_code}")

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(resp.text)
    papers = []

    for entry in root.findall("atom:entry", ns):
        arxiv_id = (entry.findtext("atom:id", "", ns) or "").split("/abs/")[-1]
        if not arxiv_id:
            continue

        title = (entry.findtext("atom:title", "", ns) or "").strip().replace("\n", " ")
        abstract = (entry.findtext("atom:summary", "", ns) or "").strip().replace("\n", " ")

        authors = [
            a.findtext("atom:name", "", ns)
            for a in entry.findall("atom:author", ns)
        ]

        published_str = entry.findtext("atom:published", "", ns) or ""
        published_at = None
        if published_str:
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        pdf_url = None
        for link in entry.findall("atom:link", ns):
            if link.get("title") == "pdf":
                pdf_url = link.get("href")
                break

        categories = [
            c.get("term", "")
            for c in entry.findall("atom:category", ns)
            if c.get("term")
        ]

        papers.append({
            "title": title,
            "abstract": abstract,
            "author_ids": authors,
            "keywords": categories,
            "source": "arxiv",
            "source_id": arxiv_id,
            "pdf_url": pdf_url,
            "published_at": published_at,
        })

        time.sleep(3)  # rate limit 준수

    return papers


# ─── Semantic Scholar 수집 ─────────────────────────────────


async def _fetch_semantic_scholar(keyword: str, max_results: int = 10) -> list[dict]:
    """Semantic Scholar API에서 논문을 검색한다."""
    headers = {}
    if settings.SS_API_KEY:
        headers["x-api-key"] = settings.SS_API_KEY

    params = {
        "query": keyword,
        "limit": min(max_results, 100),
        "fields": "paperId,title,abstract,authors,externalIds,url,publicationDate,fieldsOfStudy,openAccessPdf",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(SS_API_URL, params=params, headers=headers)
        if resp.status_code == 429:
            raise RateLimitError("SemanticScholar")
        if resp.status_code != 200:
            raise ExternalAPIError("SemanticScholar", f"status {resp.status_code}")

    data = resp.json()
    papers = []

    for item in data.get("data", []):
        paper_id = item.get("paperId", "")
        if not paper_id:
            continue

        authors = [a.get("name", "") for a in item.get("authors", []) if a.get("name")]

        published_at = None
        pub_date = item.get("publicationDate")
        if pub_date:
            try:
                published_at = datetime.strptime(pub_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        pdf_url = None
        oa_pdf = item.get("openAccessPdf")
        if oa_pdf and isinstance(oa_pdf, dict):
            pdf_url = oa_pdf.get("url")

        papers.append({
            "title": item.get("title", ""),
            "abstract": item.get("abstract"),
            "author_ids": authors,
            "keywords": item.get("fieldsOfStudy") or [],
            "source": "semantic_scholar",
            "source_id": paper_id,
            "pdf_url": pdf_url,
            "published_at": published_at,
        })

        time.sleep(3)  # rate limit 준수

    return papers


# ─── 공개 함수 (Celery 태스크) ─────────────────────────────


def collect_papers_from_arxiv(keyword: str, max_results: int = 10) -> list[dict]:
    """arXiv에서 논문을 수집하고 DB에 저장한다."""
    raw_papers = _run_async(_fetch_arxiv(keyword, max_results))
    saved = []
    for p in raw_papers:
        from app.services.paper_service import save_paper
        paper = _run_async(save_paper(**p))
        saved.append({"id": paper.id, "title": paper.title, "source": paper.source})
        logger.info("Saved arXiv paper: %s", paper.title[:60])
    return saved


def collect_papers_from_ss(keyword: str, max_results: int = 10) -> list[dict]:
    """Semantic Scholar에서 논문을 수집하고 DB에 저장한다."""
    raw_papers = _run_async(_fetch_semantic_scholar(keyword, max_results))
    saved = []
    for p in raw_papers:
        from app.services.paper_service import save_paper
        paper = _run_async(save_paper(**p))
        saved.append({"id": paper.id, "title": paper.title, "source": paper.source})
        logger.info("Saved SS paper: %s", paper.title[:60])
    return saved


@celery_app.task(
    name="app.tasks.collect.collect_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_papers(keyword: str, source: str = "all", max_results: int = 10) -> dict:
    """키워드로 논문을 수집한다. source에 따라 arXiv/SS/둘 다 수집."""
    results = {"arxiv": [], "semantic_scholar": []}

    if source in ("all", "arxiv"):
        results["arxiv"] = collect_papers_from_arxiv(keyword, max_results)

    if source in ("all", "semantic_scholar"):
        results["semantic_scholar"] = collect_papers_from_ss(keyword, max_results)

    total = len(results["arxiv"]) + len(results["semantic_scholar"])
    logger.info("Collected %d papers for keyword '%s'", total, keyword)
    return results
