import json

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.models.paper import Paper

_client: AsyncAnthropic | None = None

SYSTEM_PROMPT = """당신은 학술 연구 동향 분석 전문가입니다.
주어진 여러 논문의 제목과 초록을 비교 분석하여 연구 공백, 연결점, 후속 연구 제안을 도출하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "gaps": [
    {
      "topic": "연구 공백 주제",
      "description": "어떤 연구가 부족한지 상세 설명 (한국어)",
      "related_papers": ["paper_id1", "paper_id2"]
    }
  ],
  "connections": [
    {
      "theme": "공통 연결 테마",
      "papers": ["paper_id1", "paper_id2"],
      "description": "논문 간 연결점 설명 (한국어)"
    }
  ],
  "suggestions": [
    "구체적인 후속 연구 제안 1 (한국어)",
    "구체적인 후속 연구 제안 2 (한국어)"
  ]
}

규칙:
- gaps: 논문들 사이에서 발견되는 연구 공백 3~5개
- connections: 논문 간 공통 주제/방법론/발견의 연결점 2~4개
- suggestions: 실행 가능한 후속 연구 제안 3~5개
- related_papers, papers 필드에는 반드시 입력된 paper_id를 사용"""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def find_research_gaps(
    paper_ids: list[str],
    user_id: str,
    db: AsyncSession,
) -> dict:
    """여러 논문을 비교 분석하여 연구 공백과 연결점을 발견한다."""
    # 논문 조회
    result = await db.execute(
        select(Paper).where(Paper.id.in_(paper_ids))
    )
    papers = list(result.scalars().all())

    if len(papers) < 2:
        raise ValueError("At least 2 papers are required")

    # Claude API에 전달할 논문 정보 구성
    papers_text = ""
    for p in papers:
        papers_text += f"\n---\nPaper ID: {p.id}\n제목: {p.title}\n초록: {p.abstract or '(초록 없음)'}\n"

    client = _get_client()

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": papers_text}],
        )
    except Exception as e:
        raise ExternalAPIError("Anthropic", str(e))

    try:
        raw = message.content[0].text
        data = json.loads(raw)
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        raise ExternalAPIError("Anthropic", f"Invalid response format: {e}")

    return {
        "gaps": data.get("gaps", []),
        "connections": data.get("connections", []),
        "suggestions": data.get("suggestions", []),
    }
