import json
import uuid

from anthropic import AsyncAnthropic
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.models.reference import Reference
from app.schemas.reference import ReferenceCreate, ReferenceUpdate

_client: AsyncAnthropic | None = None

EXTRACT_SYSTEM_PROMPT = """당신은 학술 논문의 참고문헌을 분석하는 전문가입니다.
주어진 논문 제목과 초록에서 인용되거나 언급된 연구·저자·이론을 분석하여 참고문헌 목록을 추출하세요.
아래 형식의 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.

{
  "references": [
    {
      "title": "인용된 연구/논문의 제목 또는 추정 제목",
      "authors": "저자명 (알 수 있는 경우)",
      "journal": "학술지명 (알 수 있는 경우)",
      "year": 2024,
      "citation_text": "APA 스타일 인용 텍스트 (추정)"
    }
  ]
}

규칙:
- 초록에서 직접 또는 간접적으로 인용된 연구만 추출
- 정확한 정보를 알 수 없는 필드는 null로 설정
- 최소 1개, 최대 15개 참고문헌 추출
- 한국어 논문이면 한국어로, 영어 논문이면 영어로 작성"""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


async def create_reference(
    user_id: str,
    data: ReferenceCreate,
    db: AsyncSession,
) -> Reference:
    """참고문헌을 수동 생성한다."""
    ref = Reference(
        id=str(uuid.uuid4()),
        user_id=user_id,
        paper_id=data.paper_id,
        title=data.title,
        authors=data.authors,
        journal=data.journal,
        year=data.year,
        doi=data.doi,
        citation_text=data.citation_text,
        memo=data.memo,
    )
    db.add(ref)
    await db.commit()
    return ref


async def update_reference(
    ref_id: str,
    user_id: str,
    data: ReferenceUpdate,
    db: AsyncSession,
) -> Reference | None:
    """참고문헌을 수정한다. 본인 소유만 수정 가능."""
    ref = await get_reference(ref_id, user_id, db)
    if ref is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ref, field, value)

    await db.commit()
    return ref


async def delete_reference(
    ref_id: str,
    user_id: str,
    db: AsyncSession,
) -> bool:
    """참고문헌을 삭제한다."""
    ref = await get_reference(ref_id, user_id, db)
    if ref is None:
        return False
    await db.delete(ref)
    await db.commit()
    return True


async def list_references(
    user_id: str,
    paper_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> tuple[list[Reference], int]:
    """사용자의 참고문헌 목록을 조회한다."""
    base = select(Reference).where(Reference.user_id == user_id)
    count_q = select(func.count()).select_from(Reference).where(
        Reference.user_id == user_id
    )

    if paper_id:
        base = base.where(Reference.paper_id == paper_id)
        count_q = count_q.where(Reference.paper_id == paper_id)

    count_result = await db.execute(count_q)
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(Reference.created_at.desc()).limit(limit).offset(offset)
    )
    references = list(result.scalars().all())
    return references, total


async def get_reference(
    ref_id: str,
    user_id: str,
    db: AsyncSession,
) -> Reference | None:
    """참고문헌 단건 조회. 본인 소유만 반환."""
    result = await db.execute(
        select(Reference).where(
            Reference.id == ref_id,
            Reference.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def auto_extract_references(
    paper_id: str,
    title: str,
    abstract: str,
    user_id: str,
    db: AsyncSession,
) -> list[Reference]:
    """Claude API로 논문 초록에서 참고문헌을 자동 추출하고 DB에 저장한다."""
    client = _get_client()
    user_content = f"제목: {title}\n\n초록: {abstract}"

    try:
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=EXTRACT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
    except Exception as e:
        raise ExternalAPIError("Anthropic", str(e))

    try:
        raw = message.content[0].text
        data = json.loads(raw)
        refs_data = data["references"]
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        raise ExternalAPIError("Anthropic", f"Invalid response format: {e}")

    saved: list[Reference] = []
    for r in refs_data:
        ref = Reference(
            id=str(uuid.uuid4()),
            user_id=user_id,
            paper_id=paper_id,
            title=r["title"],
            authors=r.get("authors"),
            journal=r.get("journal"),
            year=r.get("year"),
            citation_text=r.get("citation_text"),
        )
        db.add(ref)
        saved.append(ref)

    await db.commit()
    return saved
