from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
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


@router.get("/export/bibtex")
async def export_references_bibtex(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await export_bibtex(user_id, db)
    return PlainTextResponse(content, media_type="text/plain; charset=utf-8")
