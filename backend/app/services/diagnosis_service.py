import json

from anthropic import AsyncAnthropic

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.schemas.diagnosis import DiagnosisItem, DiagnosisResult

_client: AsyncAnthropic | None = None

DIAGNOSIS_LABELS = [
    "명확성", "독창성", "논리구조", "방법론", "문헌검토",
    "결과해석", "재현가능성", "실용성", "문장력", "전체완성도",
]

SYSTEM_PROMPT = """당신은 학술 논문 품질 평가 전문가입니다.
주어진 논문 제목과 초록을 분석하여 아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "scores": {
    "명확성": 7,
    "독창성": 8,
    "논리구조": 6,
    "방법론": 7,
    "문헌검토": 5,
    "결과해석": 7,
    "재현가능성": 6,
    "실용성": 8,
    "문장력": 7,
    "전체완성도": 7
  },
  "feedback": "한줄 종합 피드백",
  "suggestions": ["개선제안 1", "개선제안 2", "개선제안 3"]
}

각 항목은 1~10점으로 채점하세요. suggestions는 정확히 3개 작성하세요."""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def diagnose_paper(paper_id: str, title: str, abstract: str) -> DiagnosisResult:
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

    try:
        raw = message.content[0].text
        data = json.loads(raw)
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        raise ExternalAPIError("Anthropic", f"Invalid response format: {e}")

    items = [
        DiagnosisItem(label=label, score=data["scores"][label])
        for label in DIAGNOSIS_LABELS
    ]
    total_score = sum(item.score for item in items)

    return DiagnosisResult(
        paper_id=paper_id,
        items=items,
        total_score=total_score,
        feedback=data["feedback"],
        suggestions=data["suggestions"],
    )
