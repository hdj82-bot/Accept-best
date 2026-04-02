from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.services.share_service import (
    create_share_token,
    get_shared_note,
    revoke_token,
    list_user_tokens,
)

router = APIRouter(prefix="/share", tags=["share"])


class ShareCreateBody(BaseModel):
    note_id: str
    expires_in_days: Optional[int] = None


def _build_share_url(request: Request, token: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/share/{token}"


@router.post("/")
async def create_share(
    body: ShareCreateBody,
    request: Request,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """공유 토큰 생성 → {token, share_url} 반환."""
    share = await create_share_token(
        note_id=body.note_id,
        user_id=user_id,
        db=db,
        expires_in_days=body.expires_in_days,
    )
    return {
        "token": share.token,
        "share_url": _build_share_url(request, share.token),
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
    }


@router.get("/")
async def list_my_tokens(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내 공유 토큰 목록."""
    tokens = await list_user_tokens(user_id, db)
    return [
        {
            "id": str(t.id),
            "note_id": str(t.note_id),
            "token": t.token,
            "is_active": t.is_active,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
            "created_at": t.created_at.isoformat(),
        }
        for t in tokens
    ]


@router.get("/{token}")
async def get_shared(
    token: str,
    db: AsyncSession = Depends(get_db),
    # 인증 불필요 — 공개 엔드포인트
):
    """토큰으로 공개 노트 내용 반환. 만료/비활성이면 404."""
    note = await get_shared_note(token, db)
    if note is None:
        raise HTTPException(status_code=404, detail="Shared note not found or expired")
    return {
        "note_id": str(note.id),
        "content": note.content,
        "created_at": note.created_at.isoformat(),
    }


@router.delete("/{token}", status_code=204)
async def revoke_share(
    token: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """토큰 revoke (본인만)."""
    ok = await revoke_token(token, user_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Token not found or not owned by you")
