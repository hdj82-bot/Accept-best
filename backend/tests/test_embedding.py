"""embedding_service 단위 테스트 — Gemini embed_content 호출 모킹."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ExternalAPIError
from app.services.embedding_service import (
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    create_embedding,
    embed_and_save,
)


def _mock_embed_response(vector: list[float]) -> MagicMock:
    """Gemini embed_content 응답: result.embeddings[0].values."""
    response = MagicMock()
    embedding = MagicMock()
    embedding.values = vector
    response.embeddings = [embedding]
    return response


def _patched_client(return_value=None, side_effect=None) -> MagicMock:
    client = MagicMock()
    client.aio.models.embed_content = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return client


# ──────────────────────────────────────────────
# create_embedding
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_embedding_returns_correct_dim():
    fake_vector = [0.1] * EMBEDDING_DIM
    client = _patched_client(return_value=_mock_embed_response(fake_vector))

    with patch("app.services.embedding_service.get_gemini_client", return_value=client):
        result = await create_embedding("test text")

    assert len(result) == EMBEDDING_DIM
    call_kwargs = client.aio.models.embed_content.call_args.kwargs
    assert call_kwargs["model"] == EMBEDDING_MODEL
    assert call_kwargs["contents"] == "test text"
    assert call_kwargs["config"].output_dimensionality == EMBEDDING_DIM


@pytest.mark.asyncio
async def test_create_embedding_api_error():
    client = _patched_client(side_effect=Exception("rate limit"))

    with (
        patch("app.services.embedding_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await create_embedding("test")

    assert "Gemini" in exc_info.value.message


# ──────────────────────────────────────────────
# embed_and_save
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_embed_and_save_calls_db():
    fake_vector = [0.02] * EMBEDDING_DIM

    with patch(
        "app.services.embedding_service.create_embedding",
        new_callable=AsyncMock,
        return_value=fake_vector,
    ):
        mock_db = AsyncMock()
        result = await embed_and_save("paper-123", "some text", mock_db)

    assert len(result) == EMBEDDING_DIM
    mock_db.execute.assert_called_once()
    mock_db.commit.assert_called_once()


# ──────────────────────────────────────────────
# 상수 검증
# ──────────────────────────────────────────────


def test_embedding_model_name():
    assert EMBEDDING_MODEL == "gemini-embedding-001"


def test_embedding_dimension():
    assert EMBEDDING_DIM == 1536
