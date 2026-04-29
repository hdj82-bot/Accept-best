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
    resp = await client.post("/api/survey/generate", json={"paper_id": "any"})
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
        "/api/survey/generate",
        json={"paper_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "Paper not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_generate_survey_pre_returns_questions(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    """Stage 1 (default): 사전 질문만 반환, DB 미저장, 사용량 미차감."""
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)
    fake_qs = ["차원이 무엇인가요?", "5점/7점 중 무엇이 좋으세요?", "역코딩 선호?"]

    with patch(
        "app.api.survey.generate_pre_questions",
        new_callable=AsyncMock,
        return_value=fake_qs,
    ) as mock_pre, patch(
        "app.api.survey.check_quota", new_callable=AsyncMock
    ) as mock_quota, patch(
        "app.api.survey.increment_usage", new_callable=AsyncMock
    ) as mock_incr:
        resp = await client.post(
            "/api/survey/generate",
            json={"paper_id": paper_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["stage"] == "pre"
    assert data["questions"] == fake_qs
    mock_pre.assert_awaited_once()
    # 사용량 차감은 stage=final에서만
    mock_quota.assert_not_called()
    mock_incr.assert_not_called()


@pytest.mark.asyncio
async def test_generate_survey_final_returns_items_and_charges_quota(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    """Stage 2: 최종 문항을 반환하고 사용량을 차감한다."""
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)

    class FakeSavedQuestion:
        def __init__(self, qid: str):
            self.id = qid
            self.paper_id = paper_id
            self.original_q = "원본 질문"
            self.adapted_q = "변환된 질문 (1~5점)"
            self.source_title = "핵심발견"
            self.source_page = None
            self.year = None
            self.created_at = None

    fake_saved = [FakeSavedQuestion(str(uuid.uuid4())) for _ in range(2)]

    with patch(
        "app.api.survey.generate_survey_questions",
        new_callable=AsyncMock,
        return_value=fake_saved,
    ) as mock_final, patch(
        "app.api.survey.check_quota", new_callable=AsyncMock
    ) as mock_quota, patch(
        "app.api.survey.increment_usage", new_callable=AsyncMock
    ) as mock_incr:
        resp = await client.post(
            "/api/survey/generate?stage=final",
            json={
                "paper_id": paper_id,
                "user_answers": {"차원이 무엇인가요?": "결정 자율성"},
                "variable": "자율성",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["stage"] == "final"
    assert len(data["items"]) == 2
    assert data["items"][0]["adapted_q"] == "변환된 질문 (1~5점)"
    mock_final.assert_awaited_once()
    # user_answers가 service까지 전달됐는지 확인
    final_kwargs = mock_final.call_args.kwargs
    assert final_kwargs["user_answers"] == {"차원이 무엇인가요?": "결정 자율성"}
    assert final_kwargs["variable"] == "자율성"
    mock_quota.assert_called_once()
    mock_incr.assert_called_once()


@pytest.mark.asyncio
async def test_generate_survey_final_without_user_answers_falls_back(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    """user_answers가 없어도 stage=final은 동작 (일반 응답 fallback)."""
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)

    with patch(
        "app.api.survey.generate_survey_questions",
        new_callable=AsyncMock,
        return_value=[],
    ) as mock_final, patch(
        "app.api.survey.check_quota", new_callable=AsyncMock
    ), patch(
        "app.api.survey.increment_usage", new_callable=AsyncMock
    ):
        resp = await client.post(
            "/api/survey/generate?stage=final",
            json={"paper_id": paper_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.json()["stage"] == "final"
    final_kwargs = mock_final.call_args.kwargs
    assert final_kwargs["user_answers"] is None


# ──────────────────────────────────────────────
# GET /survey
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_surveys_requires_auth(client: AsyncClient):
    resp = await client.get("/api/survey")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_surveys_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.survey.list_survey_questions",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/api/survey", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["survey_questions"] == []
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
            f"/api/survey?paper_id={fake_paper_id}", headers=auth_headers,
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
    resp = await client.get(f"/api/survey/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_survey_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.survey.get_survey_question",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(
            f"/api/survey/{uuid.uuid4()}", headers=auth_headers,
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
            f"/api/survey/{survey_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == survey_id
    assert data["question_text"] == "연구 방법론에 대해 어떻게 생각하십니까?"
