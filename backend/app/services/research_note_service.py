import uuid

from anthropic import AsyncAnthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.models.research_note import ResearchNote
from app.services.paper_version_service import save_version

_client: AsyncAnthropic | None = None

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


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


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


async def convert_note_to_draft(
    note_id: str,
    user_id: str,
    db: AsyncSession,
) -> str:
    """연구 노트를 Claude API로 학술 논문 초안으로 변환하고 auto 버전으로 저장한다."""
    note = await get_note(note_id, user_id, db)
    if note is None:
        raise ValueError("Note not found")

    client = _get_client()

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=DRAFT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": note.content}],
        )
    except Exception as e:
        raise ExternalAPIError("Anthropic", str(e))

    try:
        draft_text = message.content[0].text
    except (IndexError, AttributeError) as e:
        raise ExternalAPIError("Anthropic", f"Invalid response format: {e}")

    # auto 버전으로 저장 (10개 초과 시 자동 정리)
    await save_version(
        user_id=user_id,
        content={"source": "note_to_draft", "note_id": note_id, "draft": draft_text},
        save_type="auto",
        db=db,
    )

    return draft_text
