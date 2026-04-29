"""설문 문항 서비스 — 소크라테스식 2단계 흐름.

Stage 1 (pre):  변수/대상으로부터 사전 질문 3~5개 생성. DB 저장 없음.
Stage 2 (final): 사용자 답변을 컨텍스트로 받아 5~15개 설문 문항 생성. DB 저장.

academi.md '대화 정책' 섹션 참조. 사용자가 답을 빈칸으로 두고 final을 호출하면
일반 응답으로 fallback (단순한 즉시 생성 흐름과 호환).
"""
import json
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.survey_question import SurveyQuestion
from app.models.survey_user_answer import SurveyUserAnswer
from app.services.gemini_client import get_gemini_client

MODEL = "gemini-3-flash-preview"

PRE_QUESTIONS_PROMPT = """당신은 학술 설문 설계를 돕는 전문가입니다.
연구자가 어떤 변수를 어떤 대상에 대해 측정하려는지 정보를 받습니다.
바로 문항을 만들지 말고, **연구자에게 먼저 3~5개의 사전 질문을 던지세요**.
이 질문들은 측정 차원, 척도 선택, 응답 부담, 역코딩 선호 등 설문 설계의
핵심 결정 사항을 연구자 본인이 명료화하도록 돕는 질문이어야 합니다.

아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "stage": "pre",
  "questions": [
    "이 변수를 측정하실 때 가장 우선시하는 차원이 무엇인가요? (예: 자율성 → 결정 자율성 / 시간 자율성 / 자원 자율성)",
    "5점 척도와 7점 척도 중 어느 쪽이 선행연구와 비교 가능하실까요?",
    "응답자의 응답 부담 vs 측정 정밀도 중 어느 쪽이 더 중요하세요?",
    "역코딩 문항 포함 여부에 대한 선호가 있으신가요?"
  ]
}

규칙:
- 단정적 권고 금지. 모든 항목은 의문문이어야 함.
- 한국어 존댓말.
- 3~5개 사이.
- 변수의 도메인 특성을 반영해 일반론 대신 해당 변수에 맞춘 질문을 던질 것.
"""

FINAL_PROMPT = """당신은 학술 논문을 분석하여 연구 설문문항을 생성하는 전문가입니다.
주어진 논문 제목과 초록, 그리고 연구자가 사전 질문에 답한 내용을 분석하여
5~15개의 설문문항을 생성하세요.
연구자 답변에 명시된 척도/차원/응답 부담 선호를 가능한 한 반영하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "survey_questions": [
    {
      "original_q": "논문 내용에서 도출된 원본 연구 질문",
      "adapted_q": "설문조사에 적합하게 변환된 질문 (리커트 척도 등)",
      "source_title": "해당 질문이 도출된 논문 섹션 또는 주제",
      "source_page": null,
      "year": null
    }
  ]
}

규칙:
- original_q: 논문의 핵심 주장, 방법론, 결과에서 직접 도출한 연구 질문
- adapted_q: 실제 설문조사에서 사용할 수 있도록 변환한 문항 (한국어)
- 최소 5개, 최대 15개 문항 생성
- 연구방법론, 핵심발견, 한계점, 시사점 등 다양한 관점에서 문항 생성
- 사용자 답변이 비어 있으면 일반적 권장값(리커트 5점, 양방향 표현)으로 작성
"""


def _format_user_answers(user_answers: dict[str, str] | None) -> str:
    if not user_answers:
        return "(연구자 답변 없음 — 일반 권장값으로 작성)"
    lines = [f"- Q: {q}\n  A: {a}" for q, a in user_answers.items()]
    return "\n".join(lines)


async def generate_pre_questions(
    paper_id: str, title: str, abstract: str | None
) -> list[str]:
    """Stage 1: 사전 질문 3~5개 생성. DB 저장 없음."""
    client = get_gemini_client()
    user_content = (
        f"제목: {title}\n\n"
        f"초록: {abstract or '(없음)'}\n\n"
        "위 논문에서 도출 가능한 측정 변수에 대해 연구자에게 던질 사전 질문 3~5개를 만드세요."
    )
    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=user_content,
            config={"system_instruction": PRE_QUESTIONS_PROMPT, "max_output_tokens": 1024},
        )
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))

    try:
        data = json.loads(response.text)
        questions = data["questions"]
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    if not isinstance(questions, list) or not all(isinstance(q, str) for q in questions):
        raise ExternalAPIError("Gemini", "questions must be list[str]")
    return questions


async def generate_survey_questions(
    paper_id: str,
    title: str,
    abstract: str,
    user_id: str,
    db: AsyncSession,
    user_answers: dict[str, str] | None = None,
    variable: str | None = None,
) -> list[SurveyQuestion]:
    """Stage 2: 사용자 답변을 컨텍스트로 5~15개 문항 생성 후 DB 저장.

    user_answers가 비어 있으면 일반 응답 fallback으로 동작.
    user_answers가 있으면 새 SurveyUserAnswer 행도 함께 저장 (집계용).
    """
    client = get_gemini_client()
    user_content = (
        f"제목: {title}\n\n"
        f"초록: {abstract}\n\n"
        f"연구자 답변:\n{_format_user_answers(user_answers)}"
    )

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=user_content,
            config={"system_instruction": FINAL_PROMPT, "max_output_tokens": 2048},
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

    if user_answers:
        db.add(SurveyUserAnswer(
            id=str(uuid.uuid4()),
            user_id=user_id,
            paper_id=paper_id,
            variable=variable,
            answer_json=user_answers,
        ))

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
