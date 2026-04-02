from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("/paper/{paper_id}")
async def translate_paper_endpoint(
    paper_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    논문 제목 + 초록을 한국어로 번역.
    모든 플랜 접근 가능 (인증 필요).
    """
    from app.services.translate_service import translate_paper
    return await translate_paper(paper_id, db)


@router.post("/text")
async def translate_text_endpoint(
    body: dict,
    user_id: str = Depends(get_current_user),
):
    """
    임의 텍스트 번역. body: {"text": str, "target_lang": str = "KO"}
    """
    from app.services.translate_service import translate_text
    text = body.get("text", "")
    target_lang = body.get("target_lang", "KO")
    if not text:
        raise HTTPException(status_code=422, detail="text is required")
    return await translate_text(text, target_lang)
