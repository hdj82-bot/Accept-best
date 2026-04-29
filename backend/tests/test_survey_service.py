"""survey_service 단위 테스트 — 2단계(pre / final) Gemini 호출 모킹."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ExternalAPIError
from app.services.survey_service import (
    FINAL_PROMPT,
    PRE_QUESTIONS_PROMPT,
    generate_pre_questions,
    generate_survey_questions,
)


def _mock_response(data: dict, text_override: str | None = None) -> MagicMock:
    resp = MagicMock()
    resp.text = text_override if text_override is not None else json.dumps(
        data, ensure_ascii=False
    )
    return resp


def _patched_client(return_value=None, side_effect=None) -> MagicMock:
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(
        return_value=return_value, side_effect=side_effect
    )
    return client


PRE_VALID = {
    "stage": "pre",
    "questions": [
        "이 변수를 측정하실 때 가장 우선시하는 차원이 무엇인가요?",
        "5점 척도와 7점 척도 중 어느 쪽이 선행연구와 비교 가능하실까요?",
        "응답자의 응답 부담 vs 측정 정밀도 중 어느 쪽이 더 중요하세요?",
    ],
}

FINAL_VALID = {
    "survey_questions": [
        {
            "original_q": "자율성은 직무 만족에 어떤 영향을 미치는가?",
            "adapted_q": "내 업무 일정을 스스로 결정할 수 있다고 느낍니까? (1~5점)",
            "source_title": "핵심발견",
        },
        {
            "original_q": "조직 지원이 동기에 미치는 효과는?",
            "adapted_q": "조직이 나의 성장에 관심이 있다고 느낍니까? (1~5점)",
            "source_title": "연구방법론",
        },
    ],
}


# ──────────────────────────────────────────────
# Stage 1 (pre)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pre_returns_question_list():
    client = _patched_client(return_value=_mock_response(PRE_VALID))
    with patch("app.services.survey_service.get_gemini_client", return_value=client):
        result = await generate_pre_questions("paper-1", "자율성과 직무 만족", "초록...")

    assert result == PRE_VALID["questions"]
    call_kwargs = client.aio.models.generate_content.call_args.kwargs
    assert call_kwargs["config"]["system_instruction"] == PRE_QUESTIONS_PROMPT
    assert "자율성과 직무 만족" in call_kwargs["contents"]


@pytest.mark.asyncio
async def test_pre_invalid_json_raises_external():
    client = _patched_client(return_value=_mock_response({}, text_override="not json"))
    with (
        patch("app.services.survey_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError),
    ):
        await generate_pre_questions("p-1", "Title", "Abstract")


@pytest.mark.asyncio
async def test_pre_questions_must_be_strings():
    bad = {"stage": "pre", "questions": [1, 2, 3]}
    client = _patched_client(return_value=_mock_response(bad))
    with (
        patch("app.services.survey_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError),
    ):
        await generate_pre_questions("p-1", "Title", "Abstract")


@pytest.mark.asyncio
async def test_pre_api_error_propagates():
    client = _patched_client(side_effect=Exception("rate limit"))
    with (
        patch("app.services.survey_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError) as exc,
    ):
        await generate_pre_questions("p-1", "Title", "Abstract")
    assert "rate limit" in exc.value.message


# ──────────────────────────────────────────────
# Stage 2 (final)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_final_uses_final_prompt_and_saves():
    client = _patched_client(return_value=_mock_response(FINAL_VALID))
    db = AsyncMock()
    db.add = MagicMock()

    with patch("app.services.survey_service.get_gemini_client", return_value=client):
        saved = await generate_survey_questions(
            paper_id="paper-1",
            title="자율성과 직무 만족",
            abstract="초록...",
            user_id="user-1",
            db=db,
        )

    call_kwargs = client.aio.models.generate_content.call_args.kwargs
    assert call_kwargs["config"]["system_instruction"] == FINAL_PROMPT
    assert "(연구자 답변 없음" in call_kwargs["contents"]
    assert len(saved) == 2
    # SurveyQuestion 2건 add. user_answers 없으므로 SurveyUserAnswer는 add 안 됨.
    assert db.add.call_count == 2
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_final_with_user_answers_injects_context_and_persists_answer():
    client = _patched_client(return_value=_mock_response(FINAL_VALID))
    db = AsyncMock()
    db.add = MagicMock()

    user_answers = {
        "이 변수를 측정하실 때 가장 우선시하는 차원이 무엇인가요?": "결정 자율성",
        "5점 척도와 7점 척도 중 어느 쪽이 선행연구와 비교 가능하실까요?": "5점 척도",
    }

    with patch("app.services.survey_service.get_gemini_client", return_value=client):
        await generate_survey_questions(
            paper_id="paper-1",
            title="자율성과 직무 만족",
            abstract="초록...",
            user_id="user-1",
            db=db,
            user_answers=user_answers,
            variable="자율성",
        )

    contents = client.aio.models.generate_content.call_args.kwargs["contents"]
    assert "결정 자율성" in contents
    assert "5점 척도" in contents
    # SurveyQuestion 2건 + SurveyUserAnswer 1건 = 3 add 호출
    assert db.add.call_count == 3


@pytest.mark.asyncio
async def test_final_invalid_response_raises_external():
    client = _patched_client(return_value=_mock_response({}, text_override="garbage"))
    db = AsyncMock()
    with (
        patch("app.services.survey_service.get_gemini_client", return_value=client),
        pytest.raises(ExternalAPIError),
    ):
        await generate_survey_questions(
            paper_id="p-1", title="t", abstract="a", user_id="u-1", db=db,
        )
    db.commit.assert_not_awaited()
