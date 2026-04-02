from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection, CollectionPaper, PaperTag
from app.models.papers import Paper


# ── Collection ────────────────────────────────────────────────────────────────

async def create_collection(
    user_id: str,
    name: str,
    db: AsyncSession,
    description: Optional[str] = None,
    color: Optional[str] = None,
) -> Collection:
    col = Collection(
        user_id=uuid.UUID(user_id),
        name=name,
        description=description,
        color=color,
    )
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return col


async def list_collections(user_id: str, db: AsyncSession) -> list[dict]:
    """컬렉션 목록 + 각 컬렉션의 논문 수."""
    result = await db.execute(
        select(Collection).where(Collection.user_id == uuid.UUID(user_id))
        .order_by(Collection.created_at.desc())
    )
    collections = result.scalars().all()

    # 논문 수 일괄 조회
    counts_result = await db.execute(
        select(CollectionPaper.collection_id, func.count(CollectionPaper.id))
        .where(CollectionPaper.collection_id.in_([c.id for c in collections]))
        .group_by(CollectionPaper.collection_id)
    )
    counts = {row[0]: row[1] for row in counts_result.fetchall()}

    return [
        {
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "color": c.color,
            "paper_count": counts.get(c.id, 0),
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in collections
    ]


async def delete_collection(
    collection_id: uuid.UUID, user_id: str, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == uuid.UUID(user_id),
        )
    )
    col = result.scalar_one_or_none()
    if not col:
        return False
    await db.delete(col)   # cascade deletes CollectionPaper rows
    await db.commit()
    return True


# ── CollectionPaper ───────────────────────────────────────────────────────────

async def add_paper(
    collection_id: uuid.UUID, paper_id: uuid.UUID, user_id: str, db: AsyncSession
) -> CollectionPaper:
    """Insert a paper into a collection. Raises IntegrityError on duplicate."""
    # Verify ownership
    col_result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == uuid.UUID(user_id),
        )
    )
    if not col_result.scalar_one_or_none():
        raise PermissionError("collection not found or not owned by user")

    cp = CollectionPaper(collection_id=collection_id, paper_id=paper_id)
    db.add(cp)
    await db.commit()
    await db.refresh(cp)
    return cp


async def remove_paper(
    collection_id: uuid.UUID, paper_id: uuid.UUID, user_id: str, db: AsyncSession
) -> bool:
    # Verify ownership
    col_result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == uuid.UUID(user_id),
        )
    )
    if not col_result.scalar_one_or_none():
        return False

    result = await db.execute(
        select(CollectionPaper).where(
            CollectionPaper.collection_id == collection_id,
            CollectionPaper.paper_id == paper_id,
        )
    )
    cp = result.scalar_one_or_none()
    if not cp:
        return False
    await db.delete(cp)
    await db.commit()
    return True


async def get_collection_papers(
    collection_id: uuid.UUID, user_id: str, db: AsyncSession
) -> list[Paper]:
    # Verify ownership
    col_result = await db.execute(
        select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == uuid.UUID(user_id),
        )
    )
    if not col_result.scalar_one_or_none():
        return []

    result = await db.execute(
        select(Paper)
        .join(CollectionPaper, CollectionPaper.paper_id == Paper.id)
        .where(CollectionPaper.collection_id == collection_id)
        .order_by(CollectionPaper.added_at.desc())
    )
    return list(result.scalars().all())


# ── PaperTag ──────────────────────────────────────────────────────────────────

async def add_tag(
    user_id: str, paper_id: uuid.UUID, tag: str, db: AsyncSession
) -> PaperTag:
    """Insert a tag. Raises IntegrityError on duplicate (user, paper, tag)."""
    pt = PaperTag(user_id=uuid.UUID(user_id), paper_id=paper_id, tag=tag.strip().lower())
    db.add(pt)
    await db.commit()
    await db.refresh(pt)
    return pt


async def remove_tag(
    user_id: str, paper_id: uuid.UUID, tag: str, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(PaperTag).where(
            PaperTag.user_id == uuid.UUID(user_id),
            PaperTag.paper_id == paper_id,
            PaperTag.tag == tag.strip().lower(),
        )
    )
    pt = result.scalar_one_or_none()
    if not pt:
        return False
    await db.delete(pt)
    await db.commit()
    return True


async def get_paper_tags(
    user_id: str, paper_id: uuid.UUID, db: AsyncSession
) -> list[str]:
    result = await db.execute(
        select(PaperTag.tag).where(
            PaperTag.user_id == uuid.UUID(user_id),
            PaperTag.paper_id == paper_id,
        ).order_by(PaperTag.tag)
    )
    return [row[0] for row in result.fetchall()]


async def list_by_tag(
    user_id: str, tag: str, db: AsyncSession
) -> list[Paper]:
    result = await db.execute(
        select(Paper)
        .join(PaperTag, PaperTag.paper_id == Paper.id)
        .where(
            PaperTag.user_id == uuid.UUID(user_id),
            PaperTag.tag == tag.strip().lower(),
        )
        .order_by(PaperTag.paper_id)
    )
    return list(result.scalars().all())


async def list_all_tags(user_id: str, db: AsyncSession) -> list[dict]:
    """전체 태그 목록 + 태그별 논문 수."""
    result = await db.execute(
        select(PaperTag.tag, func.count(PaperTag.id))
        .where(PaperTag.user_id == uuid.UUID(user_id))
        .group_by(PaperTag.tag)
        .order_by(PaperTag.tag)
    )
    return [{"tag": row[0], "paper_count": row[1]} for row in result.fetchall()]
