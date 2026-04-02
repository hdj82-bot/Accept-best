from __future__ import annotations

import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.schemas.paper_versions import PaperVersionRead
from app.services.version_service import (
    save_version,
    list_versions,
    get_version,
    restore_version,
)

router = APIRouter(prefix="/versions", tags=["versions"])


class VersionCreateBody(BaseModel):
    content: Any
    save_type: str = "auto"
    label: Optional[str] = None


@router.get("/")
async def list_my_versions(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    """내 버전 목록 — content 제외, 메타만."""
    return await list_versions(user_id, db)


@router.post("/", status_code=201, response_model=PaperVersionRead)
async def create_version(
    body: VersionCreateBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """버전 저장. save_type=auto이면 최근 10개 초과분 자동 삭제."""
    if body.save_type not in ("auto", "manual"):
        raise HTTPException(status_code=422, detail="save_type must be 'auto' or 'manual'")
    return await save_version(user_id, body.content, db, body.save_type, body.label)


@router.get("/{version_id}", response_model=PaperVersionRead)
async def get_one_version(
    version_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """단건 조회 — content 포함."""
    version = await get_version(version_id, user_id, db)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/{version_id}/restore")
async def restore_one_version(
    version_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """해당 버전의 content 반환."""
    content = await restore_version(version_id, user_id, db)
    if content is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"version_id": version_id, "content": content}


@router.delete("/{version_id}", status_code=204)
async def delete_version(
    version_id: uuid.UUID,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """삭제 — manual 버전만 허용. auto 버전은 403."""
    version = await get_version(version_id, user_id, db)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if version.save_type == "auto":
        raise HTTPException(status_code=403, detail="Auto-saved versions cannot be deleted manually")
    await db.delete(version)
    await db.commit()
