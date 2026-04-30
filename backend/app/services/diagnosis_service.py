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

Accept.best 의 대화 정책(소크라테스식 질문 기반)에 따라, 단정적인 결론 대신
연구자 본인이 의도를 설명하도록 되묻는 질문을 함께 제시해야 합니다.
사실 관찰(observation)은 단정형으로 적되, 이어지는 question 은 반드시 한국어
존댓말 의문문으로 마무리하세요.

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
  "recommendations": ["연구자가 직접 검토할 보완 포인트 1", "보완 포인트 2", "보완 포인트 3"],
  "issues_with_questions": [
    {
      "section": "logic_structure",
      "observation": "서론의 연구 질문 X 와 결론의 결론 Y 사이의 연결 단계가 본문에서 명시되지 않았습니다.",
      "question": "서론의 X 와 결론 Y 를 잇는 의도하신 논리 흐름을 한 줄로 설명해 주실 수 있을까요?"
    }
  ]
}

규칙:
- overall_score: 0~100 사이 정수, 각 항목 점수의 가중 평균
- sections: 5개 항목 각각 score(0~100)와 feedback(한국어)
- recommendations: 3~5개의 보완 포인트. **단정형 결론(예: "X 가 부족합니다") 금지**.
  사실 관찰형(예: "X 의 근거가 본문에 명시되지 않았습니다") 으로 작성하고,
  결론적 권유는 issues_with_questions 의 question 으로 옮긴다.
- issues_with_questions: 2~5개. 각 항목은
  * section: sections 키 중 하나 (research_purpose / methodology /
    logic_structure / literature_use / conclusion)
  * observation: 그 섹션에서 본 객관적 사실 1~2문장 (단정 OK, 가치 판단 X)
  * question: 연구자가 본인 의도를 설명하도록 유도하는 한국어 존댓말 의문문 1개.
    "~을(를) 어떻게 ~하셨는지 알려주실 수 있을까요?", "~의 의도는 무엇인가요?" 류.
- 초록만으로 판단이 어려운 항목은 보수적으로 평가하되 이유를 feedback 에 명시"""


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
        # 모델 응답이 신규 필드를 누락하더라도 None 으로 들어가게 둔다 (점진 백필).
        issues_with_questions=data.get("issues_with_questions"),
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
