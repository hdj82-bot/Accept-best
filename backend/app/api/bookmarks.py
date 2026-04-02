from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.bookmark import Bookmark
from app.models.papers import Paper
from app.schemas.papers import PaperRead

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("/", response_model=List[PaperRead])
async def list_bookmarks(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 북마크 논문 목록."""
    result = await db.execute(
        select(Paper)
        .join(Bookmark, Bookmark.paper_id == Paper.id)
        .where(Bookmark.user_id == uuid.UUID(user_id))
        .order_by(Bookmark.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/{paper_id}", status_code=201)
async def add_bookmark(
    paper_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """북마크 추가. 이미 존재하면 409."""
    paper = await db.get(Paper, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    bookmark = Bookmark(user_id=uuid.UUID(user_id), paper_id=paper_id)
    db.add(bookmark)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already bookmarked")

    return {"bookmarked": True, "paper_id": str(paper_id)}


@router.delete("/{paper_id}", status_code=204)
async def remove_bookmark(
    paper_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """북마크 제거."""
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == uuid.UUID(user_id),
            Bookmark.paper_id == paper_id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")

    await db.delete(bookmark)
    await db.commit()
