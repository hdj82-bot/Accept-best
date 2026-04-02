"""
Tests for the survey questions API endpoints.

Auth (get_current_user) and DB (get_db) dependencies are overridden.
Service calls are mocked to avoid real DB access.
"""

import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import app
from app.core.auth import get_current_user
from app.core.database import get_db

# Fixed user UUID used across all tests
_TEST_USER_ID = str(uuid.uuid4())


def _override_current_user():
    """Dependency override: always return the test user id."""
    return _TEST_USER_ID


async def _override_get_db():
    """Dependency override: yield a MagicMock session so no real DB is needed."""
    yield MagicMock()


# Apply overrides to the FastAPI app
app.dependency_overrides[get_current_user] = _override_current_user
app.dependency_overrides[get_db] = _override_get_db


# ── helpers ───────────────────────────────────────────────────────────────────

def _make_sq_mock(question_id=None, user_id=None, paper_id=None):
    sq = MagicMock()
    sq.id = question_id or uuid.uuid4()
    sq.user_id = uuid.UUID(user_id) if user_id else uuid.uuid4()
    sq.paper_id = uuid.UUID(paper_id) if paper_id else None
    sq.original_q = "원문 질문입니다."
    sq.adapted_q = "연구에 적용한 질문입니다."
    sq.source_title = "Test Paper"
    sq.source_page = None
    sq.year = None
    sq.created_at = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    sq.updated_at = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    return sq


# ── test_create_survey_question ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_survey_question(client):
    """POST /api/survey/ — should create a question and return 201."""
    mock_sq = _make_sq_mock(user_id=_TEST_USER_ID)

    with patch(
        "app.api.survey.create_question",
        new_callable=AsyncMock,
        return_value=mock_sq,
    ):
        response = await client.post(
            "/api/survey/",
            json={
                "original_q": "원문 질문입니다.",
                "adapted_q": "연구에 적용한 질문입니다.",
                "paper_id": None,
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["original_q"] == "원문 질문입니다."


# ── test_list_survey_questions ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_survey_questions(client):
    """GET /api/survey/?paper_id={id} — should return a list."""
    paper_id = uuid.uuid4()
    mock_sq = _make_sq_mock(user_id=_TEST_USER_ID, paper_id=str(paper_id))

    with patch(
        "app.api.survey.list_questions",
        new_callable=AsyncMock,
        return_value=[mock_sq],
    ):
        response = await client.get(f"/api/survey/?paper_id={paper_id}")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["original_q"] == "원문 질문입니다."


@pytest.mark.asyncio
async def test_list_survey_questions_no_filter(client):
    """GET /api/survey/ without paper_id — should return all user questions."""
    mock_sq1 = _make_sq_mock(user_id=_TEST_USER_ID)
    mock_sq2 = _make_sq_mock(user_id=_TEST_USER_ID)

    with patch(
        "app.api.survey.list_questions",
        new_callable=AsyncMock,
        return_value=[mock_sq1, mock_sq2],
    ):
        response = await client.get("/api/survey/")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2


# ── test_generate_survey_questions_fires_task ─────────────────────────────────

@pytest.mark.asyncio
async def test_generate_survey_questions_fires_task(client):
    """POST /api/survey/generate/{paper_id} — should fire Celery task, return task_id."""
    import app.tasks.process as process_module  # ensure module is imported

    paper_id = uuid.uuid4()
    fake_task = MagicMock()
    fake_task.id = str(uuid.uuid4())

    with patch.object(
        process_module.generate_survey_questions,
        "delay",
        return_value=fake_task,
    ) as mock_delay:
        response = await client.post(f"/api/survey/generate/{paper_id}")

    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert data["task_id"] == fake_task.id
    mock_delay.assert_called_once_with(
        user_id=_TEST_USER_ID,
        paper_id=str(paper_id),
    )


# ── test_delete_survey_question ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_survey_question(client):
    """DELETE /api/survey/{id} — should return 204."""
    question_id = uuid.uuid4()

    with patch(
        "app.api.survey.delete_question",
        new_callable=AsyncMock,
        return_value=True,
    ):
        response = await client.delete(f"/api/survey/{question_id}")

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_delete_survey_question_not_found(client):
    """DELETE /api/survey/{id} — should return 404 when question doesn't exist."""
    question_id = uuid.uuid4()

    with patch(
        "app.api.survey.delete_question",
        new_callable=AsyncMock,
        return_value=False,
    ):
        response = await client.delete(f"/api/survey/{question_id}")

    assert response.status_code == 404
