import json
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.survey_question import SurveyQuestion
from app.services.gemini_client import get_gemini_client

MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = """당신은 학술 논문을 분석하여 연구 설문문항을 생성하는 전문가입니다.
주어진 논문 제목과 초록을 분석하여 5~10개의 설문문항을 생성하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "survey_questions": [
    {
      "original_q": "논문 내용에서 도출된 원본 연구 질문",
      "adapted_q": "설문조사에 적합하게 변환된 질문 (리커트 5점 척도 등 활용 가능)",
      "source_title": "해당 질문이 도출된 논문 섹션 또는 주제 (예: 연구방법론, 핵심발견, 한계점)",
      "source_page": null,
      "year": null
    }
  ]
}

규칙:
- original_q: 논문의 핵심 주장, 방법론, 결과에서 직접 도출한 연구 질문
- adapted_q: 실제 설문조사에서 사용할 수 있도록 변환한 문항 (한국어)
- 최소 5개, 최대 10개 문항 생성
- 연구방법론, 핵심발견, 한계점, 시사점 등 다양한 관점에서 문항 생성"""


async def generate_survey_questions(
    paper_id: str,
    title: str,
    abstract: str,
    user_id: str,
    db: AsyncSession,
) -> list[SurveyQuestion]:
    """Gemini API로 논문 기반 설문문항을 생성하고 DB에 저장한다."""
    client = get_gemini_client()
    user_content = f"제목: {title}\n\n초록: {abstract}"

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=user_content,
            config={"system_instruction": SYSTEM_PROMPT, "max_output_tokens": 2048},
        )
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))

    try:
        data = json.loads(response.text)
        questions_data = data["survey_questions"]
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    saved: list[SurveyQuestion] = []
    for q in questions_data:
        sq = SurveyQuestion(
            id=str(uuid.uuid4()),
            user_id=user_id,
            paper_id=paper_id,
            original_q=q["original_q"],
            adapted_q=q["adapted_q"],
            source_title=q.get("source_title"),
            source_page=q.get("source_page"),
            year=q.get("year"),
        )
        db.add(sq)
        saved.append(sq)

    await db.commit()
    return saved


async def list_survey_questions(
    user_id: str,
    paper_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> tuple[list[SurveyQuestion], int]:
    """사용자의 설문문항 목록을 조회한다."""
    base = select(SurveyQuestion).where(SurveyQuestion.user_id == user_id)
    count_q = select(func.count()).select_from(SurveyQuestion).where(
        SurveyQuestion.user_id == user_id
    )

    if paper_id:
        base = base.where(SurveyQuestion.paper_id == paper_id)
        count_q = count_q.where(SurveyQuestion.paper_id == paper_id)

    count_result = await db.execute(count_q)
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(SurveyQuestion.created_at.desc()).limit(limit).offset(offset)
    )
    questions = list(result.scalars().all())
    return questions, total


async def get_survey_question(
    survey_id: str,
    user_id: str,
    db: AsyncSession,
) -> SurveyQuestion | None:
    """설문문항 단건 조회. 본인 소유만 반환."""
    result = await db.execute(
        select(SurveyQuestion).where(
            SurveyQuestion.id == survey_id,
            SurveyQuestion.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()
