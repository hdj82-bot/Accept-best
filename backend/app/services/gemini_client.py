from google import genai

from app.core.config import settings

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    """Gemini API 클라이언트 싱글톤."""
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client
