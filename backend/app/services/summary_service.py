import json

from app.core.exceptions import ExternalAPIError
from app.schemas.summary import SummaryRead
from app.services.gemini_client import get_gemini_client

MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = """당신은 학술 논문 분석 전문가입니다.
주어진 논문 제목과 초록을 분석하여 아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

응답 원칙 (academi.md "대화 정책"):
- 사실 관찰(요약·핵심 발견·방법론·한계)은 단정형으로 정확히 기술합니다.
- 마지막에 follow_up_questions 1~2개를 연구자에게 되묻는 질문 형태로 작성합니다.
- 단정형 X / 질문형 O 예시:
  X: "이 논문은 당신의 연구에 적합합니다."
  O: "이 논문에서 가장 활용 가치 있는 부분이 어떤 곳인가요?"
  O: "현재 진행 중인 연구의 어느 단계에서 이 논문을 참고하실 계획인가요?"

{
  "summary_ko": "한국어 3~5문장 요약",
  "key_findings": ["핵심 발견 1", "핵심 발견 2", "핵심 발견 3"],
  "methodology": "연구 방법론 1~2문장",
  "limitations": "한계점 1~2문장",
  "follow_up_questions": ["연구자에게 던지는 질문 1", "연구자에게 던지는 질문 2"]
}"""


async def summarize_paper(paper_id: str, title: str, abstract: str) -> SummaryRead:
    """Gemini API로 논문 초록을 한국어 요약."""
    client = get_gemini_client()
    user_content = f"제목: {title}\n\n초록: {abstract}"

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=user_content,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 1024},
        )
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))

    try:
        data = json.loads(response.text)
    except (json.JSONDecodeError, ValueError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    return SummaryRead(
        paper_id=paper_id,
        title=title,
        summary_ko=data["summary_ko"],
        key_findings=data["key_findings"],
        methodology=data["methodology"],
        limitations=data["limitations"],
        follow_up_questions=data.get("follow_up_questions", []),
    )
