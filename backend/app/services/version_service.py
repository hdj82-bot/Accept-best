from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper_versions import PaperVersion

AUTO_KEEP = 10  # auto 저장 최대 보관 개수


async def save_version(
    user_id: str,
    content: Any,
    db: AsyncSession,
    save_type: str = "auto",
    label: Optional[str] = None,
) -> PaperVersion:
    """
    paper_versions에 INSERT.
    save_type='auto'일 때 10개 초과분 중 가장 오래된 auto 행 삭제.
    """
    version = PaperVersion(
        user_id=uuid.UUID(user_id),
        content=content,
        save_type=save_type,
        label=label,
    )
    db.add(version)
    await db.flush()  # ID 확보

    if save_type == "auto":
        # 현재 유저의 auto 버전 개수 확인
        count_result = await db.execute(
            select(func.count(PaperVersion.id)).where(
                PaperVersion.user_id == uuid.UUID(user_id),
                PaperVersion.save_type == "auto",
            )
        )
        count = count_result.scalar_one()

        if count > AUTO_KEEP:
            # 가장 오래된 auto 행 ID 조회
            oldest_result = await db.execute(
                select(PaperVersion.id)
                .where(
                    PaperVersion.user_id == uuid.UUID(user_id),
                    PaperVersion.save_type == "auto",
                )
                .order_by(PaperVersion.created_at.asc())
                .limit(count - AUTO_KEEP)
            )
            oldest_ids = [row[0] for row in oldest_result.fetchall()]
            await db.execute(
                delete(PaperVersion).where(PaperVersion.id.in_(oldest_ids))
            )

    await db.commit()
    await db.refresh(version)
    return version


async def list_versions(
    user_id: str,
    db: AsyncSession,
    limit: int = 20,
) -> list[PaperVersion]:
    """목록 조회 — content 컬럼 제외, 메타만."""
    result = await db.execute(
        select(
            PaperVersion.id,
            PaperVersion.user_id,
            PaperVersion.save_type,
            PaperVersion.label,
            PaperVersion.created_at,
        )
        .where(PaperVersion.user_id == uuid.UUID(user_id))
        .order_by(PaperVersion.created_at.desc())
        .limit(limit)
    )
    rows = result.fetchall()
    # Row → 가벼운 dict 리스트로 반환 (content 제외)
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "save_type": r.save_type,
            "label": r.label,
            "created_at": r.created_at,
        }
        for r in rows
    ]


async def get_version(
    version_id: uuid.UUID,
    user_id: str,
    db: AsyncSession,
) -> Optional[PaperVersion]:
    """단건 조회 (content 포함)."""
    result = await db.execute(
        select(PaperVersion).where(
            PaperVersion.id == version_id,
            PaperVersion.user_id == uuid.UUID(user_id),
        )
    )
    return result.scalar_one_or_none()


async def restore_version(
    version_id: uuid.UUID,
    user_id: str,
    db: AsyncSession,
) -> Optional[Any]:
    """해당 버전의 content만 반환."""
    version = await get_version(version_id, user_id, db)
    if version is None:
        return None
    return version.content
