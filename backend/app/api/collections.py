from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.schemas.papers import PaperRead
from app.services.collection_service import (
    create_collection,
    list_collections,
    delete_collection,
    add_paper,
    remove_paper,
    get_collection_papers,
    add_tag,
    remove_tag,
    get_paper_tags,
    list_by_tag,
    list_all_tags,
)

router = APIRouter(tags=["collections"])


class CollectionCreateBody(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class TagBody(BaseModel):
    tag: str


# ── Collection CRUD ───────────────────────────────────────────────────────────

@router.get("/collections/")
async def list_my_collections(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 컬렉션 목록 (논문 수 포함)."""
    return await list_collections(user_id, db)


@router.post("/collections/", status_code=201)
async def create_my_collection(
    body: CollectionCreateBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """컬렉션 생성."""
    col = await create_collection(
        user_id=user_id,
        name=body.name,
        description=body.description,
        color=body.color,
        db=db,
    )
    return {
        "id": str(col.id),
        "name": col.name,
        "description": col.description,
        "color": col.color,
        "created_at": col.created_at.isoformat(),
    }


@router.delete("/collections/{collection_id}", status_code=204)
async def delete_my_collection(
    collection_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """컬렉션 삭제 (cascade로 중간 테이블 함께 삭제)."""
    ok = await delete_collection(collection_id, user_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Collection not found")


# ── Collection papers ─────────────────────────────────────────────────────────

@router.get("/collections/{collection_id}/papers", response_model=List[PaperRead])
async def list_collection_papers(
    collection_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """컬렉션 내 논문 목록."""
    papers = await get_collection_papers(collection_id, user_id, db)
    if papers == [] :
        # Could be empty OR not found — check ownership
        from sqlalchemy import select  # noqa: PLC0415
        from app.models.collection import Collection  # noqa: PLC0415
        result = await db.execute(
            select(Collection).where(
                Collection.id == collection_id,
                Collection.user_id == uuid.UUID(user_id),
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Collection not found")
    return papers


@router.post("/collections/{collection_id}/papers/{paper_id}", status_code=201)
async def add_paper_to_collection(
    collection_id: uuid.UUID,
    paper_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """컬렉션에 논문 추가. 이미 존재하면 409."""
    try:
        cp = await add_paper(collection_id, paper_id, user_id, db)
    except PermissionError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Paper already in collection")
    return {"collection_id": str(collection_id), "paper_id": str(paper_id), "added_at": cp.added_at.isoformat()}


@router.delete("/collections/{collection_id}/papers/{paper_id}", status_code=204)
async def remove_paper_from_collection(
    collection_id: uuid.UUID,
    paper_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """컬렉션에서 논문 제거."""
    ok = await remove_paper(collection_id, paper_id, user_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Paper not found in collection")


# ── Tags ──────────────────────────────────────────────────────────────────────

@router.get("/tags/")
async def list_my_tags(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 전체 태그 목록 (논문 수 포함)."""
    return await list_all_tags(user_id, db)


@router.get("/tags/{tag}/papers", response_model=List[PaperRead])
async def list_papers_by_tag(
    tag: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """태그별 논문 목록."""
    return await list_by_tag(user_id, tag, db)


@router.post("/papers/{paper_id}/tags", status_code=201)
async def add_paper_tag(
    paper_id: uuid.UUID,
    body: TagBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """태그 추가. 중복이면 409."""
    try:
        pt = await add_tag(user_id, paper_id, body.tag, db)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Tag already exists for this paper")
    return {"paper_id": str(paper_id), "tag": pt.tag}


@router.delete("/papers/{paper_id}/tags/{tag}", status_code=204)
async def remove_paper_tag(
    paper_id: uuid.UUID,
    tag: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """태그 제거."""
    ok = await remove_tag(user_id, paper_id, tag, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Tag not found")
