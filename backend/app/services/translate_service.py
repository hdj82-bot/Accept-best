from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def translate_text(text: str, target_lang: str = "KO") -> dict:
    """
    DeepL API로 텍스트 번역.
    use_fixtures=true 또는 deepl_api_key 미설정 시 mock 반환.
    실패 시 원문 그대로 반환 (폴백).
    """
    settings = get_settings()

    if settings.use_fixtures:
        return {
            "translated_text": f"[번역 미리보기] {text[:100]}",
            "detected_source_lang": "EN",
            "fixture": True,
        }

    if not settings.deepl_api_key:
        logger.warning("DEEPL_API_KEY not set — returning untranslated text")
        return {
            "translated_text": text,
            "detected_source_lang": "unknown",
            "error": "DEEPL_API_KEY not configured",
        }

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api-free.deepl.com/v2/translate",
                headers={"Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}"},
                json={"text": [text], "target_lang": target_lang},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            result = data["translations"][0]
            return {
                "translated_text": result["text"],
                "detected_source_lang": result["detected_source_language"],
            }
    except Exception as e:
        logger.warning("translate_text failed: %s", e)
        return {
            "translated_text": text,
            "detected_source_lang": "unknown",
            "error": str(e),
        }


async def translate_paper(paper_id: str, db: AsyncSession) -> dict:
    """
    Paper의 title + abstract를 번역해서 반환.
    title_ko, abstract_ko 키 포함.
    """
    import uuid as _uuid
    from app.models.papers import Paper
    from sqlalchemy import select

    result = await db.execute(
        select(Paper).where(Paper.id == _uuid.UUID(paper_id))
    )
    paper = result.scalar_one_or_none()
    if not paper:
        return {"error": "Paper not found"}

    title_result = await translate_text(paper.title or "")
    abstract_result = await translate_text(paper.abstract or "")

    return {
        "paper_id": paper_id,
        "title_ko": title_result["translated_text"],
        "abstract_ko": abstract_result["translated_text"],
        "fixture": title_result.get("fixture", False),
    }
