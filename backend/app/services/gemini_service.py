"""
Gemini 폴백 서비스.
Claude API 실패 시 대안으로 사용하는 텍스트 생성 함수.
"""

from __future__ import annotations

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def generate_with_gemini(prompt: str, max_tokens: int = 1024) -> str:
    """
    Gemini Pro로 텍스트 생성.
    use_fixtures=true 시 fixture 반환, gemini_api_key 미설정 시 빈 문자열 반환.
    """
    settings = get_settings()

    if settings.use_fixtures:
        return "[Gemini fixture] 분석 결과입니다."

    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini generation")
        return ""

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.warning("generate_with_gemini failed: %s", e)
        return ""


async def summarize_with_gemini(text: str) -> str:
    """
    논문 초록을 Gemini로 요약. Claude 실패 시 폴백 진입점.
    """
    prompt = (
        "다음 논문 초록을 3문장으로 한국어 요약하세요:\n\n"
        f"{text[:3000]}"
    )
    return await generate_with_gemini(prompt)
