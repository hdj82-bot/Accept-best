from openai import AsyncOpenAI
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.models.paper import Paper

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def create_embedding(text: str) -> list[float]:
    """텍스트로부터 1536차원 임베딩 벡터 생성."""
    client = _get_client()
    try:
        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
            dimensions=EMBEDDING_DIM,
        )
        return response.data[0].embedding
    except Exception as e:
        raise ExternalAPIError("OpenAI", str(e))


async def embed_and_save(paper_id: str, text: str, db: AsyncSession) -> list[float]:
    """임베딩 생성 후 papers 테이블에 저장."""
    embedding = await create_embedding(text)
    await db.execute(
        update(Paper).where(Paper.id == paper_id).values(embedding=embedding)
    )
    await db.commit()
    return embedding
