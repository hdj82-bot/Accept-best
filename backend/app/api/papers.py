import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.schemas.paper import (
    PaperListResponse,
    PaperRead,
    PaperSearchRequest,
    PaperSearchResponse,
)
from app.services.paper_service import get_paper, list_papers, save_paper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/papers", tags=["papers"])

ARXIV_API_URL = "http://export.arxiv.org/api/query"


async def _collect_from_arxiv(keyword: str, max_results: int = 10) -> int:
    """arXiv에서 논문을 검색하여 DB에 저장한다. 저장 건수 반환."""
    import xml.etree.ElementTree as ET
    from datetime import datetime

    params = {
        "search_query": f"all:{keyword}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(ARXIV_API_URL, params=params)
        if resp.status_code != 200:
            logger.error("arXiv API error: status %d", resp.status_code)
            return 0

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(resp.text)
    count = 0

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

        await save_paper(
            title=title,
            abstract=abstract,
            author_ids=authors,
            keywords=categories,
            source="arxiv",
            source_id=arxiv_id,
            pdf_url=pdf_url,
            published_at=published_at,
        )
        count += 1

    return count


@router.get("/search")
async def search_papers_get(
    keyword: str = Query(..., min_length=1),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    """키워드로 논문을 수집하고 결과를 반환한다."""
    try:
        collected = await _collect_from_arxiv(keyword, per_page)
        logger.info("Collected %d papers for '%s'", collected, keyword)
    except Exception as e:
        logger.exception("논문 수집 실패: %s", e)

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
    try:
        collected = await _collect_from_arxiv(req.keyword, req.max_results)
    except Exception:
        collected = 0

    return PaperSearchResponse(
        task_id="direct-execution",
        message=f"수집 완료: {collected}건. 키워드: {req.keyword}",
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
