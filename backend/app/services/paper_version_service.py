import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper_version import PaperVersion

MAX_AUTO_VERSIONS = 10


async def save_version(
    user_id: str,
    content: dict,
    save_type: str,
    db: AsyncSession,
) -> PaperVersion:
    """논문 버전을 저장한다. auto 타입은 user당 최대 10개 유지."""
    version = PaperVersion(
        id=str(uuid.uuid4()),
        user_id=user_id,
        content=content,
        save_type=save_type,
    )
    db.add(version)
    await db.flush()

    if save_type == "auto":
        await _prune_auto_versions(user_id, db)

    await db.commit()
    return version


async def _prune_auto_versions(user_id: str, db: AsyncSession) -> None:
    """auto 버전이 MAX_AUTO_VERSIONS를 초과하면 가장 오래된 것부터 삭제."""
    count_result = await db.execute(
        select(func.count()).select_from(PaperVersion).where(
            PaperVersion.user_id == user_id,
            PaperVersion.save_type == "auto",
        )
    )
    total = count_result.scalar() or 0

    if total <= MAX_AUTO_VERSIONS:
        return

    # 오래된 순으로 초과분 ID 조회
    excess = total - MAX_AUTO_VERSIONS
    old_ids_result = await db.execute(
        select(PaperVersion.id)
        .where(
            PaperVersion.user_id == user_id,
            PaperVersion.save_type == "auto",
        )
        .order_by(PaperVersion.created_at.asc())
        .limit(excess)
    )
    old_ids = [row[0] for row in old_ids_result.all()]

    if old_ids:
        await db.execute(
            delete(PaperVersion).where(PaperVersion.id.in_(old_ids))
        )


async def list_versions(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession | None = None,
) -> tuple[list[PaperVersion], int]:
    """사용자의 논문 버전 목록을 조회한다."""
    count_result = await db.execute(
        select(func.count()).select_from(PaperVersion).where(
            PaperVersion.user_id == user_id
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(PaperVersion)
        .where(PaperVersion.user_id == user_id)
        .order_by(PaperVersion.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    versions = list(result.scalars().all())
    return versions, total


async def get_version(
    version_id: str,
    user_id: str,
    db: AsyncSession,
) -> PaperVersion | None:
    """논문 버전 단건 조회. 본인 소유만 반환."""
    result = await db.execute(
        select(PaperVersion).where(
            PaperVersion.id == version_id,
            PaperVersion.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_version(
    version_id: str,
    user_id: str,
    db: AsyncSession,
) -> bool:
    """manual 버전만 삭제 가능. 성공 시 True, 실패 시 False."""
    version = await get_version(version_id, user_id, db)
    if version is None:
        return False
    if version.save_type != "manual":
        return False

    await db.delete(version)
    await db.commit()
    return True
