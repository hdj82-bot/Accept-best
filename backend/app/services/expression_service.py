import json

from anthropic import AsyncAnthropic

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.schemas.expression import ExpressionItem, ExpressionResponse

_client: AsyncAnthropic | None = None

SYSTEM_PROMPT = """당신은 학술 논문 작성 전문가입니다.
사용자가 입력한 한국어 문장이나 키워드에 대해 학술 논문에서 사용할 수 있는 표현을 추천하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "items": [
    {
      "korean": "한국어 학술 표현",
      "english": "English academic expression",
      "usage_example": "이 표현을 사용한 예시 문장 (영어)"
    }
  ]
}

5~10개의 표현을 추천하세요. context가 주어지면 해당 섹션(서론/방법/결과/결론)에 적합한 표현을 우선 추천하세요."""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def suggest_expressions(text: str, context: str | None = None) -> ExpressionResponse:
    client = _get_client()
    user_content = f"입력: {text}"
    if context:
        user_content += f"\n섹션: {context}"

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
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

    items = [ExpressionItem(**item) for item in data["items"]]
    return ExpressionResponse(items=items)
