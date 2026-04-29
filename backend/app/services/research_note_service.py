import json
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.research_note import ResearchNote
from app.services.gemini_client import get_gemini_client
from app.services.paper_version_service import save_version

MODEL = "gemini-3-flash-preview"

DRAFT_SYSTEM_PROMPT = """당신은 학술 논문 작성 전문가입니다.
주어진 연구 노트를 학술 논문 초안으로 변환하세요.
아래 구조를 따르되, 한국어로 작성하세요.

## 서론
- 연구 배경 및 필요성
- 연구 목적 및 연구 질문

## 본론
- 이론적 배경 / 선행연구 검토
- 연구 방법
- 연구 결과

## 결론
- 연구 요약 및 시사점
- 한계점 및 향후 연구 방향

규칙:
- 연구 노트의 핵심 내용을 빠짐없이 포함
- 학술적 문체 사용
- 각 섹션에 적절한 분량 배분
- Markdown 형식으로 작성"""

PRE_QUESTIONS_SYSTEM_PROMPT = """당신은 학술 논문 작성을 돕는 전문가입니다.
연구자가 제출한 연구 노트를 받았습니다. 노트를 곧바로 초안으로 변환하기 전에,
연구자가 의도하는 방향을 정확히 반영하기 위해 **3~5개의 사전 질문**을 만들어주세요.

응답 원칙 (academi.md "대화 정책"):
- 단정형으로 결론을 제시하지 마세요. 연구자에게 되묻는 질문 형태로 작성합니다.
- 단정형 X / 질문형 O 예시:
  X: "이 노트의 공통 주장은 디지털 격차 해소입니다."
  O: "이 노트들의 공통 주장을 한 줄로 요약하신다면 어떤 문장이 되시겠어요?"
  O: "초안의 독자(IRB 심사자/학회/저널)는 누구를 가정하고 계세요?"

질문 작성 가이드:
- 연구자만 알 수 있는 맥락(독자 가정·연구 단계·방법론 선호 등)을 묻습니다.
- 추상적·일반적 질문이 아니라 노트 내용에 근거한 구체 질문을 우선합니다.
- JSON 배열만 반환하세요. 다른 텍스트는 포함하지 마세요.

응답 형식:
["질문 1", "질문 2", "질문 3"]"""


async def create_note(
    user_id: str,
    content: str,
    db: AsyncSession,
) -> ResearchNote:
    """연구 노트를 생성한다."""
    note = ResearchNote(
        id=str(uuid.uuid4()),
        user_id=user_id,
        content=content,
    )
    db.add(note)
    await db.commit()
    return note


async def update_note(
    note_id: str,
    user_id: str,
    content: str,
    db: AsyncSession,
) -> ResearchNote | None:
    """연구 노트를 수정한다. 본인 소유만 수정 가능."""
    note = await get_note(note_id, user_id, db)
    if note is None:
        return None
    note.content = content
    await db.commit()
    return note


async def delete_note(
    note_id: str,
    user_id: str,
    db: AsyncSession,
) -> bool:
    """연구 노트를 삭제한다."""
    note = await get_note(note_id, user_id, db)
    if note is None:
        return False
    await db.delete(note)
    await db.commit()
    return True


async def list_notes(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> tuple[list[ResearchNote], int]:
    """사용자의 연구 노트 목록을 조회한다."""
    count_result = await db.execute(
        select(func.count()).select_from(ResearchNote).where(
            ResearchNote.user_id == user_id
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(ResearchNote)
        .where(ResearchNote.user_id == user_id)
        .order_by(ResearchNote.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    notes = list(result.scalars().all())
    return notes, total


async def get_note(
    note_id: str,
    user_id: str,
    db: AsyncSession,
) -> ResearchNote | None:
    """연구 노트 단건 조회. 본인 소유만 반환."""
    result = await db.execute(
        select(ResearchNote).where(
            ResearchNote.id == note_id,
            ResearchNote.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def generate_pre_questions(
    note_id: str,
    user_id: str,
    db: AsyncSession,
) -> list[str]:
    """초안 변환 전 연구자에게 던질 사전 질문 3~5개를 생성한다."""
    note = await get_note(note_id, user_id, db)
    if note is None:
        raise ValueError("Note not found")

    client = get_gemini_client()

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=note.content,
            config={
                "system_instruction": PRE_QUESTIONS_SYSTEM_PROMPT,
                "max_output_tokens": 1024,
            },
        )
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))

    try:
        questions = json.loads(response.text)
    except (json.JSONDecodeError, ValueError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    if not isinstance(questions, list):
        raise ExternalAPIError("Gemini", "Expected JSON array of questions")

    return [str(q) for q in questions]


async def convert_note_to_draft(
    note_id: str,
    user_id: str,
    db: AsyncSession,
    user_answers: dict[str, str] | None = None,
) -> str:
    """연구 노트를 Gemini API로 학술 논문 초안으로 변환하고 auto 버전으로 저장한다.

    user_answers가 제공되면 사전 질문에 대한 연구자 답변을 컨텍스트로 주입.
    None이거나 빈 dict면 일반 초안 생성으로 fallback (정책상 답변은 선택).
    """
    note = await get_note(note_id, user_id, db)
    if note is None:
        raise ValueError("Note not found")

    client = get_gemini_client()

    if user_answers:
        answers_text = "\n".join(f"Q: {q}\nA: {a}" for q, a in user_answers.items())
        contents = (
            f"{note.content}\n\n---\n[연구자 사전 답변]\n{answers_text}\n\n"
            "위 답변에 담긴 의도를 반영해 초안을 작성하세요."
        )
    else:
        contents = note.content

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=contents,
            config={"system_instruction": DRAFT_SYSTEM_PROMPT, "max_output_tokens": 4096},
        )
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))

    try:
        draft_text = response.text
    except (ValueError, AttributeError) as e:
        raise ExternalAPIError("Gemini", f"Invalid response format: {e}")

    await save_version(
        user_id=user_id,
        content={"source": "note_to_draft", "note_id": note_id, "draft": draft_text},
        save_type="auto",
        db=db,
    )

    return draft_text
