import json
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.diagnosis import Diagnosis
from app.services.gemini_client import get_gemini_client

MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = """당신은 학술 논문 품질 진단 전문가입니다.
주어진 논문 제목과 초록을 분석하여 논문 건강검진 결과를 생성하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "overall_score": 75,
  "sections": {
    "research_purpose": {"score": 80, "feedback": "연구목적 명확성에 대한 피드백"},
    "methodology": {"score": 70, "feedback": "방법론 적절성에 대한 피드백"},
    "logic_structure": {"score": 75, "feedback": "논리 구조에 대한 피드백"},
    "literature_use": {"score": 65, "feedback": "문헌 활용에 대한 피드백"},
    "conclusion": {"score": 80, "feedback": "결론 타당성에 대한 피드백"}
  },
  "recommendations": ["구체적인 개선 권장사항 1", "구체적인 개선 권장사항 2", "구체적인 개선 권장사항 3"]
}

규칙:
- overall_score: 0~100 사이 정수, 각 항목 점수의 가중 평균
- sections: 5개 항목 각각 score(0~100)와 feedback(한국어)
- recommendations: 3~5개의 구체적이고 실행 가능한 개선 권장사항 (한국어)
- 초록만으로 판단이 어려운 항목은 보수적으로 평가하되 이유를 feedback에 명시"""


async def diagnose_paper(
    paper_id: str,
    title: str,
    abstract: str,
    user_id: str,
    db: AsyncSession,
) -> Diagnosis:
    """Gemini API로 논문 건강검진을 수행하고 결과를 DB에 저장한다."""
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
    except (json.JSONDecodeError, ValueError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    diagnosis = Diagnosis(
        id=str(uuid.uuid4()),
        user_id=user_id,
        paper_id=paper_id,
        overall_score=data["overall_score"],
        sections=data["sections"],
        recommendations=data["recommendations"],
    )
    db.add(diagnosis)
    await db.commit()
    return diagnosis


async def list_diagnoses(
    user_id: str,
    paper_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> tuple[list[Diagnosis], int]:
    """사용자의 건강검진 결과 목록을 조회한다."""
    base = select(Diagnosis).where(Diagnosis.user_id == user_id)
    count_q = select(func.count()).select_from(Diagnosis).where(
        Diagnosis.user_id == user_id
    )

    if paper_id:
        base = base.where(Diagnosis.paper_id == paper_id)
        count_q = count_q.where(Diagnosis.paper_id == paper_id)

    count_result = await db.execute(count_q)
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(Diagnosis.created_at.desc()).limit(limit).offset(offset)
    )
    diagnoses = list(result.scalars().all())
    return diagnoses, total


async def get_diagnosis(
    diagnosis_id: str,
    user_id: str,
    db: AsyncSession,
) -> Diagnosis | None:
    """건강검진 결과 단건 조회. 본인 소유만 반환."""
    result = await db.execute(
        select(Diagnosis).where(
            Diagnosis.id == diagnosis_id,
            Diagnosis.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()
