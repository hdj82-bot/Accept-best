from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reference import Reference
from app.schemas.reference import ReferenceCreate, ReferenceUpdate


async def list_references(user_id: str, db: AsyncSession) -> List[Reference]:
    result = await db.execute(
        select(Reference)
        .where(Reference.user_id == uuid.UUID(user_id))
        .order_by(Reference.created_at.desc())
    )
    return list(result.scalars().all())


async def create_reference(
    user_id: str, data: ReferenceCreate, db: AsyncSession
) -> Reference:
    ref = Reference(user_id=uuid.UUID(user_id), **data.model_dump())
    db.add(ref)
    await db.commit()
    await db.refresh(ref)
    return ref


async def update_reference(
    ref_id: uuid.UUID, user_id: str, data: ReferenceUpdate, db: AsyncSession
) -> Optional[Reference]:
    result = await db.execute(
        select(Reference).where(
            Reference.id == ref_id,
            Reference.user_id == uuid.UUID(user_id),
        )
    )
    ref = result.scalar_one_or_none()
    if not ref:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ref, field, value)
    await db.commit()
    await db.refresh(ref)
    return ref


async def delete_reference(
    ref_id: uuid.UUID, user_id: str, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(Reference).where(
            Reference.id == ref_id,
            Reference.user_id == uuid.UUID(user_id),
        )
    )
    ref = result.scalar_one_or_none()
    if not ref:
        return False
    await db.delete(ref)
    await db.commit()
    return True


async def export_bibtex(user_id: str, db: AsyncSession) -> str:
    refs = await list_references(user_id, db)
    entries: List[str] = []
    for ref in refs:
        key = ref.cite_key or f"ref_{str(ref.id)[:8]}"
        lines = [f"@article{{{key},"]
        lines.append(f"  title={{{ref.title}}},")
        if ref.authors:
            lines.append(f"  author={{{ref.authors}}},")
        if ref.journal:
            lines.append(f"  journal={{{ref.journal}}},")
        if ref.year is not None:
            lines.append(f"  year={{{ref.year}}},")
        if ref.doi:
            lines.append(f"  doi={{{ref.doi}}},")
        lines.append("}")
        entries.append("\n".join(lines))
    return "\n\n".join(entries)
