from openai import OpenAI

from app.core.config import get_settings

settings = get_settings()
_client = OpenAI(api_key=settings.openai_api_key)

_MODEL = "text-embedding-3-small"
_BATCH_SIZE = 100


def get_embedding(text: str) -> list[float]:
    response = _client.embeddings.create(model=_MODEL, input=text)
    return response.data[0].embedding


def batch_embed(texts: list[str]) -> list[list[float]]:
    results = []
    for i in range(0, len(texts), _BATCH_SIZE):
        batch = texts[i : i + _BATCH_SIZE]
        response = _client.embeddings.create(model=_MODEL, input=batch)
        results.extend([item.embedding for item in response.data])
    return results
