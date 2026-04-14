from google.genai import types
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.paper import Paper
from app.services.gemini_client import get_gemini_client

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 1536


async def create_embedding(text: str) -> list[float]:
    """텍스트로부터 1536차원 임베딩 벡터 생성."""
    client = get_gemini_client()
    try:
        result = await client.aio.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM),
        )
        return list(result.embeddings[0].values)
    except Exception as e:
        raise ExternalAPIError("Gemini", str(e))


async def embed_and_save(paper_id: str, text: str, db: AsyncSession) -> list[float]:
    """임베딩 생성 후 papers 테이블에 저장."""
    embedding = await create_embedding(text)
    await db.execute(
        update(Paper).where(Paper.id == paper_id).values(embedding=embedding)
    )
    await db.commit()
    return embedding
