"""summary_service 단위 테스트 — Gemini API 호출 모킹."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ExternalAPIError
from app.schemas.summary import SummaryRead
from app.services.summary_service import MODEL, SYSTEM_PROMPT, summarize_paper


def _mock_gemini_response(data: dict | None, text_override: str | None = None) -> MagicMock:
    """Gemini generate_content 응답 객체 모킹. data 또는 text_override 중 하나 사용."""
    response = MagicMock()
    response.text = text_override if text_override is not None else json.dumps(data, ensure_ascii=False)
    return response


def _patched_client(return_value=None, side_effect=None) -> MagicMock:
    """get_gemini_client가 반환할 mock client. aio.models.generate_content가 AsyncMock."""
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return client


VALID_RESPONSE = {
    "summary_ko": "트랜스포머 아키텍처를 제안합니다.",
    "key_findings": ["셀프 어텐션 메커니즘", "병렬 처리 가능"],
    "methodology": "인코더-디코더 구조",
    "limitations": "긴 시퀀스 처리 비용이 큼",
    "follow_up_questions": [
        "이 논문에서 가장 활용 가치 있는 부분이 어떤 곳인가요?",
        "현재 진행 중인 연구의 어느 단계에서 이 논문을 참고하실 계획인가요?",
    ],
}


# ──────────────────────────────────────────────
# 정상 호출
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_returns_summary_read():
    client = _patched_client(return_value=_mock_gemini_response(VALID_RESPONSE))

    with patch("app.services.summary_service.get_gemini_client", return_value=client):
        result = await summarize_paper("paper-1", "Attention Is All You Need", "We propose...")

    assert isinstance(result, SummaryRead)
    assert result.paper_id == "paper-1"
    assert result.title == "Attention Is All You Need"
    assert result.summary_ko == VALID_RESPONSE["summary_ko"]
    assert len(result.key_findings) == 2
    assert result.methodology == VALID_RESPONSE["methodology"]


@pytest.mark.asyncio
async def test_summarize_includes_follow_up_questions():
    """소크라테스식 대화 정책: 응답에 후속 질문 포함."""
    client = _patched_client(return_value=_mock_gemini_response(VALID_RESPONSE))

    with patch("app.services.summary_service.get_gemini_client", return_value=client):
        result = await summarize_paper("p-1", "Title", "Abstract")

    assert len(result.follow_up_questions) == 2
    assert "활용 가치" in result.follow_up_questions[0]


@pytest.mark.asyncio
async def test_summarize_missing_follow_up_questions_defaults_empty():
    """follow_up_questions 누락 시 빈 리스트로 fallback (정책상 후속 질문은 권장이지만 응답이 누락돼도 깨지지 않게)."""
    response_without_questions = {k: v for k, v in VALID_RESPONSE.items() if k != "follow_up_questions"}
    client = _patched_client(return_value=_mock_gemini_response(response_without_questions))

    with patch("app.services.summary_service.get_gemini_client", return_value=client):
        result = await summarize_paper("p-1", "Title", "Abstract")

    assert result.follow_up_questions == []


@pytest.mark.asyncio
async def test_summarize_passes_correct_params():
    client = _patched_client(return_value=_mock_gemini_response(VALID_RESPONSE))

    with patch("app.services.summary_service.get_gemini_client", return_value=client):
        await summarize_paper("p-1", "Title", "Abstract text")

    call_kwargs = client.aio.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == MODEL
    assert call_kwargs["config"]["system_instruction"] == SYSTEM_PROMPT
    assert call_kwargs["config"]["max_output_tokens"] == 1024
    assert "Title" in call_kwargs["contents"]
    assert "Abstract text" in call_kwargs["contents"]


# ──────────────────────────────────────────────
# API 에러
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_api_error_raises_external():
    client = _patched_client(side_effect=Exception("overloaded"))

    with (
        patch("app.services.summary_service.get_gemini_client", return_value=client),
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
    client = _patched_client(return_value=_mock_gemini_response(None, text_override="This is not JSON"))

    with (
        patch("app.services.summary_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await summarize_paper("p-1", "Title", "Abstract")

    assert "Invalid response format" in exc_info.value.message


@pytest.mark.asyncio
async def test_summarize_missing_field_raises_external():
    """필수 필드 누락 → KeyError → service가 처리 안 함 → 그대로 propagate."""
    incomplete = {"summary_ko": "요약만 있음"}
    client = _patched_client(return_value=_mock_gemini_response(incomplete))

    with (
        patch("app.services.summary_service.get_gemini_client", return_value=client),
        pytest.raises(KeyError),
    ):
        await summarize_paper("p-1", "Title", "Abstract")


@pytest.mark.asyncio
async def test_summarize_empty_response_raises_external():
    """response.text가 빈 문자열 → JSONDecodeError → ExternalAPIError."""
    client = _patched_client(return_value=_mock_gemini_response(None, text_override=""))

    with (
        patch("app.services.summary_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError) as exc_info,
    ):
        await summarize_paper("p-1", "Title", "Abstract")

    assert "Invalid response format" in exc_info.value.message
