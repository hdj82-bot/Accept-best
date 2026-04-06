import logging

from app.core.config import get_settings
from app.core.exceptions import ExternalAPIError

logger = logging.getLogger(__name__)

_MODEL = "text-embedding-3-small"
_BATCH_SIZE = 100
_DIMENSIONS = 1536


def _get_client():
    settings = get_settings()
    if not settings.openai_api_key:
        raise ExternalAPIError("OpenAI", "OPENAI_API_KEY not configured")
    from openai import OpenAI
    return OpenAI(api_key=settings.openai_api_key)


def get_embedding(text: str) -> list[float]:
    settings = get_settings()
    if settings.use_fixtures:
        return [0.0] * _DIMENSIONS

    client = _get_client()
    response = client.embeddings.create(model=_MODEL, input=text)
    return response.data[0].embedding


def batch_embed(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    if settings.use_fixtures:
        return [[0.0] * _DIMENSIONS for _ in texts]

    client = _get_client()
    results = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        response = client.embeddings.create(model=_MODEL, input=batch)
        results.extend([item.embedding for item in response.data])
    return results
