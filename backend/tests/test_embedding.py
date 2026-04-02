from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ExternalAPIError
from app.services.embedding_service import (
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    create_embedding,
    embed_and_save,
)


# ──────────────────────────────────────────────
# create_embedding
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_embedding_returns_correct_dim():
    """OpenAI API → 1536차원 벡터."""
    fake_vector = [0.1] * 1536
    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=fake_vector)]

    mock_client = AsyncMock()
    mock_client.embeddings.create.return_value = mock_response

    with patch("app.services.embedding_service._get_client", return_value=mock_client):
        result = await create_embedding("test text")

    assert len(result) == 1536
    mock_client.embeddings.create.assert_called_once_with(
        model=EMBEDDING_MODEL,
        input="test text",
        dimensions=EMBEDDING_DIM,
    )


@pytest.mark.asyncio
async def test_create_embedding_api_error():
    """OpenAI 오류 → ExternalAPIError 변환."""
    mock_client = AsyncMock()
    mock_client.embeddings.create.side_effect = Exception("rate limit")

    with (
        patch("app.services.embedding_service._get_client", return_value=mock_client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await create_embedding("test")

    assert "OpenAI" in exc_info.value.message


# ──────────────────────────────────────────────
# embed_and_save
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_embed_and_save_calls_db():
    """임베딩 생성 + DB update 호출 확인."""
    fake_vector = [0.02] * 1536

    with patch(
        "app.services.embedding_service.create_embedding",
        new_callable=AsyncMock,
        return_value=fake_vector,
    ):
        mock_db = AsyncMock()
        result = await embed_and_save("paper-123", "some text", mock_db)

    assert len(result) == 1536
    mock_db.execute.assert_called_once()
    mock_db.commit.assert_called_once()


# ──────────────────────────────────────────────
# 상수 검증
# ──────────────────────────────────────────────

def test_embedding_model_name():
    assert EMBEDDING_MODEL == "text-embedding-3-small"


def test_embedding_dimension():
    assert EMBEDDING_DIM == 1536
