from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.diagnosis_service import get_diagnosis
from app.services.paper_service import get_paper

router = APIRouter(prefix="/share", tags=["share"])


# ── 인라인 스키마 ──────────────────────────────


class PaperShareCard(BaseModel):
    title: str
    abstract_summary: str
    authors: list[str]
    keywords: list[str]
    published_at: datetime | None = None
    share_url: str


class DiagnosisShareCard(BaseModel):
    paper_title: str
    overall_score: int
    section_scores: dict[str, int]
    created_at: datetime | None = None
    share_url: str


# ── 엔드포인트 ─────────────────────────────────


@router.get("/paper/{paper_id}", response_model=PaperShareCard)
async def share_paper(paper_id: str):
    """논문 공유 카드 데이터를 반환한다 (인증 불필요)."""
    paper = await get_paper(paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found")

    abstract_summary = (paper.abstract or "")[:200]

    return PaperShareCard(
        title=paper.title,
        abstract_summary=abstract_summary,
        authors=paper.author_ids or [],
        keywords=paper.keywords or [],
        published_at=paper.published_at,
        share_url=f"/share/paper/{paper_id}",
    )


@router.get("/diagnosis/{diagnosis_id}", response_model=DiagnosisShareCard)
async def share_diagnosis(diagnosis_id: str):
    """진단 결과 공유 카드 데이터를 반환한다 (인증 불필요)."""
    diagnosis = await get_diagnosis(diagnosis_id)
    if diagnosis is None:
        raise HTTPException(status_code=404, detail="Diagnosis not found")

    # 진단에 연결된 논문 제목 조회
    paper = await get_paper(diagnosis.paper_id)
    paper_title = paper.title if paper else "Unknown"

    return DiagnosisShareCard(
        paper_title=paper_title,
        overall_score=diagnosis.overall_score,
        section_scores=diagnosis.section_scores,
        created_at=diagnosis.created_at,
        share_url=f"/share/diagnosis/{diagnosis_id}",
    )
