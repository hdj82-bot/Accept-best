"""research_gaps API 엔드포인트 테스트."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, settings.NEXTAUTH_SECRET, algorithm="HS256")


# ──────────────────────────────────────────────
# POST /research-gaps/analyze
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analyze_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/research-gaps/analyze",
        json={"paper_ids": [str(uuid.uuid4()), str(uuid.uuid4())]},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_analyze_paper_not_found(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    existing_id = seeded_papers[0].id
    missing_id = str(uuid.uuid4())

    resp = await client.post(
        "/research-gaps/analyze",
        json={"paper_ids": [existing_id, missing_id]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "Paper not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_analyze_success(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_ids = [p.id for p in seeded_papers[:3]]
    token = make_token(user_id)

    with patch("app.api.research_gaps.get_user", new_callable=AsyncMock, return_value=user), \
         patch("app.api.research_gaps.check_quota", new_callable=AsyncMock) as mock_quota, \
         patch("app.api.research_gaps.increment_usage", new_callable=AsyncMock) as mock_incr:
        resp = await client.post(
            "/research-gaps/analyze",
            json={"paper_ids": paper_ids},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert "message" in data
    mock_quota.assert_called_once()
    mock_incr.assert_called_once()


# ──────────────────────────────────────────────
# GET /research-gaps/result/{task_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_result_requires_auth(client: AsyncClient):
    resp = await client.get(f"/research-gaps/result/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_result_pending(client: AsyncClient, auth_headers: dict):
    mock_result = MagicMock()
    mock_result.ready.return_value = False

    with patch("app.api.research_gaps.celery_app", create=True) as mock_celery:
        mock_celery.AsyncResult.return_value = mock_result
        # celery_app import를 모킹하기 위해 모듈 레벨 패치
        with patch("app.api.research_gaps.celery_app", mock_celery):
            resp = await client.get(
                f"/research-gaps/result/{uuid.uuid4()}", headers=auth_headers,
            )

    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_result_failed(client: AsyncClient, auth_headers: dict):
    mock_result = MagicMock()
    mock_result.ready.return_value = True
    mock_result.successful.return_value = False
    mock_result.result = Exception("분석 실패")

    with patch("app.tasks.celery_app") as mock_celery:
        mock_celery.AsyncResult.return_value = mock_result
        resp = await client.get(
            f"/research-gaps/result/{uuid.uuid4()}", headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "failed"
    assert "detail" in data


@pytest.mark.asyncio
async def test_result_celery_unavailable_returns_pending(
    client: AsyncClient, auth_headers: dict,
):
    """Celery 미연결 시 pending을 반환한다."""
    with patch(
        "app.tasks.celery_app",
        side_effect=Exception("connection refused"),
    ):
        resp = await client.get(
            f"/research-gaps/result/{uuid.uuid4()}", headers=auth_headers,
        )

    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
