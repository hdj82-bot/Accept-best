"""survey API 엔드포인트 테스트."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, settings.NEXTAUTH_SECRET, algorithm="HS256")


# ──────────────────────────────────────────────
# POST /survey/generate
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_survey_requires_auth(client: AsyncClient):
    resp = await client.post("/survey/generate", json={"paper_id": "any"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_generate_survey_paper_not_found(
    client: AsyncClient, db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    resp = await client.post(
        "/survey/generate",
        json={"paper_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "Paper not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_generate_survey_success(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)

    with patch("app.api.survey.check_quota", new_callable=AsyncMock) as mock_quota, \
         patch("app.api.survey.increment_usage", new_callable=AsyncMock) as mock_incr:
        resp = await client.post(
            "/survey/generate",
            json={"paper_id": paper_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert "message" in data
    mock_quota.assert_called_once()
    mock_incr.assert_called_once()


# ──────────────────────────────────────────────
# GET /survey
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_surveys_requires_auth(client: AsyncClient):
    resp = await client.get("/survey")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_surveys_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.survey.list_survey_questions",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/survey", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["questions"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_surveys_with_paper_id(client: AsyncClient, auth_headers: dict):
    fake_paper_id = str(uuid.uuid4())
    with patch(
        "app.api.survey.list_survey_questions",
        new_callable=AsyncMock,
        return_value=([], 0),
    ) as mock_list:
        resp = await client.get(
            f"/survey?paper_id={fake_paper_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    mock_list.assert_called_once_with(
        paper_id=fake_paper_id, limit=20, offset=0,
    )


# ──────────────────────────────────────────────
# GET /survey/{survey_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_survey_requires_auth(client: AsyncClient):
    resp = await client.get(f"/survey/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_survey_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.survey.get_survey_question",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(
            f"/survey/{uuid.uuid4()}", headers=auth_headers,
        )

    assert resp.status_code == 404
    assert "Survey question not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_survey_success(client: AsyncClient, auth_headers: dict):
    survey_id = str(uuid.uuid4())

    class FakeQuestion:
        def __init__(self):
            self.id = survey_id
            self.paper_id = str(uuid.uuid4())
            self.question_text = "연구 방법론에 대해 어떻게 생각하십니까?"
            self.question_type = "likert"
            self.options = ["매우 동의", "동의", "보통", "비동의", "매우 비동의"]
            self.created_at = "2026-04-07T00:00:00Z"

    with patch(
        "app.api.survey.get_survey_question",
        new_callable=AsyncMock,
        return_value=FakeQuestion(),
    ):
        resp = await client.get(
            f"/survey/{survey_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == survey_id
    assert data["question_text"] == "연구 방법론에 대해 어떻게 생각하십니까?"
