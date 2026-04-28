"""summary_service 단위 테스트 — Claude API 호출 모킹."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ExternalAPIError
from app.schemas.summary import SummaryRead
from app.services.summary_service import SYSTEM_PROMPT, summarize_paper


def _mock_claude_response(data: dict) -> MagicMock:
    """Claude API 응답 객체를 모킹."""
    text_block = MagicMock()
    text_block.text = json.dumps(data, ensure_ascii=False)
    response = MagicMock()
    response.content = [text_block]
    return response


VALID_RESPONSE = {
    "summary_ko": "트랜스포머 아키텍처를 제안합니다.",
    "key_findings": ["셀프 어텐션 메커니즘", "병렬 처리 가능"],
    "methodology": "인코더-디코더 구조",
    "limitations": "긴 시퀀스 처리 비용이 큼",
}


# ──────────────────────────────────────────────
# 정상 호출
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_returns_summary_read():
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _mock_claude_response(VALID_RESPONSE)

    with patch("app.services.summary_service._get_client", return_value=mock_client):
        result = await summarize_paper("paper-1", "Attention Is All You Need", "We propose...")

    assert isinstance(result, SummaryRead)
    assert result.paper_id == "paper-1"
    assert result.title == "Attention Is All You Need"
    assert result.summary_ko == VALID_RESPONSE["summary_ko"]
    assert len(result.key_findings) == 2
    assert result.methodology == VALID_RESPONSE["methodology"]


@pytest.mark.asyncio
async def test_summarize_passes_correct_params():
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _mock_claude_response(VALID_RESPONSE)

    with patch("app.services.summary_service._get_client", return_value=mock_client):
        await summarize_paper("p-1", "Title", "Abstract text")

    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-sonnet-4-20250514"
    assert call_kwargs["max_tokens"] == 1024
    assert call_kwargs["system"] == SYSTEM_PROMPT
    assert "Title" in call_kwargs["messages"][0]["content"]
    assert "Abstract text" in call_kwargs["messages"][0]["content"]


# ──────────────────────────────────────────────
# API 에러
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_api_error_raises_external():
    mock_client = AsyncMock()
    mock_client.messages.create.side_effect = Exception("overloaded")

    with (
        patch("app.services.summary_service._get_client", return_value=mock_client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await summarize_paper("p-1", "Title", "Abstract")

    assert "Gemini" in exc_info.value.message
    assert "overloaded" in exc_info.value.message


# ──────────────────────────────────────────────
# 잘못된 JSON 응답
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_invalid_json_raises_external():
    text_block = MagicMock()
    text_block.text = "This is not JSON"
    response = MagicMock()
    response.content = [text_block]

    mock_client = AsyncMock()
    mock_client.messages.create.return_value = response

    with (
        patch("app.services.summary_service._get_client", return_value=mock_client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await summarize_paper("p-1", "Title", "Abstract")

    assert "Invalid response format" in exc_info.value.message


@pytest.mark.asyncio
async def test_summarize_missing_field_raises_external():
    """필수 필드 누락 → ExternalAPIError."""
    incomplete = {"summary_ko": "요약만 있음"}  # key_findings, methodology, limitations 없음

    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _mock_claude_response(incomplete)

    with (
        patch("app.services.summary_service._get_client", return_value=mock_client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await summarize_paper("p-1", "Title", "Abstract")

    assert "Invalid response format" in exc_info.value.message


@pytest.mark.asyncio
async def test_summarize_empty_content_raises_external():
    """빈 content 배열 → IndexError → ExternalAPIError."""
    response = MagicMock()
    response.content = []

    mock_client = AsyncMock()
    mock_client.messages.create.return_value = response

    with (
        patch("app.services.summary_service._get_client", return_value=mock_client),
        pytest.raises(ExternalAPIError),
    ):
        await summarize_paper("p-1", "Title", "Abstract")
