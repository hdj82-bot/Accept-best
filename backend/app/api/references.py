from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.bookmark import Bookmark
from app.models.papers import Paper
from app.models.reference import Reference
from app.schemas.reference import ReferenceCreate, ReferenceRead, ReferenceUpdate
from app.services.reference_service import (
    create_reference,
    delete_reference,
    export_bibtex,
    list_references,
    update_reference,
)

router = APIRouter(prefix="/references", tags=["references"])


@router.get("/", response_model=list[ReferenceRead])
async def list_my_references(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_references(user_id, db)


@router.post("/", response_model=ReferenceRead, status_code=201)
async def create_my_reference(
    body: ReferenceCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_reference(user_id, body, db)


@router.patch("/{ref_id}", response_model=ReferenceRead)
async def update_my_reference(
    ref_id: uuid.UUID,
    body: ReferenceUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ref = await update_reference(ref_id, user_id, body, db)
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")
    return ref


@router.delete("/{ref_id}", status_code=204)
async def delete_my_reference(
    ref_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_reference(ref_id, user_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Reference not found")


@router.post("/import/bookmarks")
async def import_from_bookmarks(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """북마크된 논문을 참고문헌으로 일괄 import. doi 중복은 스킵."""
    # 유저의 북마크된 논문 조회
    result = await db.execute(
        select(Paper)
        .join(Bookmark, Bookmark.paper_id == Paper.id)
        .where(Bookmark.user_id == uuid.UUID(user_id))
    )
    papers = result.scalars().all()

    # 기존 참고문헌의 doi 목록 조회 (중복 체크용)
    existing_result = await db.execute(
        select(Reference.doi).where(
            Reference.user_id == uuid.UUID(user_id),
            Reference.doi.isnot(None),
        )
    )
    existing_dois = {row[0] for row in existing_result.fetchall()}

    imported = 0
    skipped = 0
    for paper in papers:
        if paper.doi and paper.doi in existing_dois:
            skipped += 1
            continue
        authors_str = ", ".join(paper.authors) if paper.authors else None
        ref = Reference(
            user_id=uuid.UUID(user_id),
            title=paper.title,
            authors=authors_str,
            year=paper.year,
            doi=paper.doi,
            url=paper.url,
        )
        db.add(ref)
        if paper.doi:
            existing_dois.add(paper.doi)
        imported += 1

    await db.commit()
    return {"imported": imported, "skipped": skipped}


@router.get("/export/bibtex")
async def export_references_bibtex(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await export_bibtex(user_id, db)
    return PlainTextResponse(content, media_type="text/plain; charset=utf-8")
