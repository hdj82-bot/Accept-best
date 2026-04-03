from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.papers import Paper
from app.models.research_notes import ResearchNote

logger = logging.getLogger(__name__)

FIXTURE_RESULT = {
    "summary": "수집된 논문 분석 결과, 다음 영역에서 연구 공백이 발견되었습니다.",
    "gaps": [
        {
            "title": "장기 종단 연구 부재",
            "description": "대부분의 연구가 단기 효과만 측정하며, 5년 이상 추적 연구가 없습니다.",
            "severity": "high",
        },
        {
            "title": "한국어 맥락 적용 연구 부족",
            "description": "국내 교육 환경에 특화된 실증 연구가 미흡합니다.",
            "severity": "medium",
        },
        {
            "title": "정량·정성 혼합 방법론 연구",
            "description": "현재까지 정량 연구 위주이며 심층 인터뷰 병행 연구가 없습니다.",
            "severity": "medium",
        },
    ],
    "opportunities": [
        "국내 대학생 대상 종단 연구 설계",
        "혼합 방법론 적용을 통한 심층 이해",
        "교육 현장 적용 가능한 실천적 가이드라인 도출",
    ],
    "paper_count": 0,
    "fixture": True,
}


async def analyze_research_gap(
    note_id: str,
    user_id: str,
    db: AsyncSession,
) -> dict:
    """
    1. research_notes에서 note 조회 (본인 소유 확인)
    2. papers 테이블에서 최근 수집된 논문 최대 20편 조회 (user_id 기준, created_at desc)
    3. 각 논문의 title + abstract(앞 200자)를 concat해 컨텍스트 생성
    4. Claude Haiku 호출 또는 USE_FIXTURES mock
    5. 결과 반환
    """
    import uuid as _uuid

    # 노트 조회
    result = await db.execute(
        select(ResearchNote).where(
            ResearchNote.id == _uuid.UUID(note_id),
            ResearchNote.user_id == _uuid.UUID(user_id),
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        return {**FIXTURE_RESULT, "paper_count": 0}

    # 논문 최대 20편 조회
    papers_result = await db.execute(
        select(Paper)
        .order_by(Paper.created_at.desc())
        .limit(20)
    )
    papers = list(papers_result.scalars().all())

    settings = get_settings()
    if settings.use_fixtures or not papers:
        return {**FIXTURE_RESULT, "paper_count": len(papers)}

    # 논문 컨텍스트 구성
    context_parts = []
    for i, p in enumerate(papers, 1):
        abstract_snippet = (p.abstract or "")[:200]
        context_parts.append(f"{i}. {p.title}\n   {abstract_snippet}")
    context = "\n\n".join(context_parts)

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — returning fixture for gap analysis")
        return {**FIXTURE_RESULT, "paper_count": len(papers), "fixture": True}

    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "다음 논문 목록을 분석하고 연구 공백을 JSON으로 반환하세요.\n"
                        "형식: {\n"
                        '  "summary": "전체 분석 요약 문자열",\n'
                        '  "gaps": [{"title": "공백 제목", "description": "설명", "severity": "high|medium|low"}],\n'
                        '  "opportunities": ["연구 기회 1", "연구 기회 2"]\n'
                        "}\n\n"
                        f"논문 목록 ({len(papers)}편):\n{context[:4000]}"
                    ),
                }
            ],
        )
        text = message.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        parsed = json.loads(text[start:end])
        parsed["paper_count"] = len(papers)
        return parsed
    except Exception as exc:
        logger.warning("gap analysis Claude call failed: %s", exc)
        return {**FIXTURE_RESULT, "paper_count": len(papers), "fixture": True}
