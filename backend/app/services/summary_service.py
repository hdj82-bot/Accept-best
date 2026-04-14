from anthropic import AsyncAnthropic

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.schemas.summary import SummaryRead

_client: AsyncAnthropic | None = None

SYSTEM_PROMPT = """당신은 학술 논문 분석 전문가입니다.
주어진 논문 제목과 초록을 분석하여 아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "summary_ko": "한국어 3~5문장 요약",
  "key_findings": ["핵심 발견 1", "핵심 발견 2", "핵심 발견 3"],
  "methodology": "연구 방법론 1~2문장",
  "limitations": "한계점 1~2문장"
}"""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def summarize_paper(paper_id: str, title: str, abstract: str) -> SummaryRead:
    """Claude API로 논문 초록을 한국어 요약."""
    client = _get_client()
    user_content = f"제목: {title}\n\n초록: {abstract}"

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
    except Exception as e:
        raise ExternalAPIError("Anthropic", str(e))

    import json

    try:
        raw = message.content[0].text
        data = json.loads(raw)
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        raise ExternalAPIError("Anthropic", f"Invalid response format: {e}")

    return SummaryRead(
        paper_id=paper_id,
        title=title,
        summary_ko=data["summary_ko"],
        key_findings=data["key_findings"],
        methodology=data["methodology"],
        limitations=data["limitations"],
    )
