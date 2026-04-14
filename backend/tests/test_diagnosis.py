"""diagnosis & share API 엔드포인트 테스트."""

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
# POST /diagnosis/run
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_diagnosis_requires_auth(client: AsyncClient):
    resp = await client.post("/diagnosis/run", json={"paper_id": "any"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_run_diagnosis_paper_not_found(
    client: AsyncClient, db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    resp = await client.post(
        "/diagnosis/run",
        json={"paper_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "Paper not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_run_diagnosis_success(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)

    with patch("app.api.diagnosis.get_user", new_callable=AsyncMock, return_value=user), \
         patch("app.api.diagnosis.check_quota", new_callable=AsyncMock) as mock_quota, \
         patch("app.api.diagnosis.increment_usage", new_callable=AsyncMock) as mock_incr:
        resp = await client.post(
            "/diagnosis/run",
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
# GET /diagnosis
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_diagnoses_requires_auth(client: AsyncClient):
    resp = await client.get("/diagnosis")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_diagnoses_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.diagnosis.list_diagnoses",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/diagnosis", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["diagnoses"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_diagnoses_with_paper_id(client: AsyncClient, auth_headers: dict):
    fake_paper_id = str(uuid.uuid4())
    with patch(
        "app.api.diagnosis.list_diagnoses",
        new_callable=AsyncMock,
        return_value=([], 0),
    ) as mock_list:
        resp = await client.get(
            f"/diagnosis?paper_id={fake_paper_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    mock_list.assert_called_once_with(
        paper_id=fake_paper_id, limit=20, offset=0,
    )


# ──────────────────────────────────────────────
# GET /diagnosis/{diagnosis_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_diagnosis_requires_auth(client: AsyncClient):
    resp = await client.get(f"/diagnosis/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_diagnosis_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.diagnosis.get_diagnosis",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(
            f"/diagnosis/{uuid.uuid4()}", headers=auth_headers,
        )

    assert resp.status_code == 404
    assert "Diagnosis not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_diagnosis_success(client: AsyncClient, auth_headers: dict):
    diagnosis_id = str(uuid.uuid4())

    class FakeDiagnosis:
        def __init__(self):
            self.id = diagnosis_id
            self.paper_id = str(uuid.uuid4())
            self.overall_score = 78
            self.section_scores = {"introduction": 80, "methodology": 75, "results": 82}
            self.feedback = "전반적으로 양호하나 방법론 보강 필요"
            self.created_at = "2026-04-07T00:00:00Z"

    with patch(
        "app.api.diagnosis.get_diagnosis",
        new_callable=AsyncMock,
        return_value=FakeDiagnosis(),
    ):
        resp = await client.get(
            f"/diagnosis/{diagnosis_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == diagnosis_id
    assert data["overall_score"] == 78


# ──────────────────────────────────────────────
# GET /share/paper/{paper_id} (인증 불필요)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_share_paper_not_found(client: AsyncClient):
    resp = await client.get(f"/share/paper/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_share_paper_success(client: AsyncClient, seeded_papers):
    paper = seeded_papers[0]
    resp = await client.get(f"/share/paper/{paper.id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == paper.title
    assert len(data["abstract_summary"]) <= 200
    assert data["share_url"] == f"/share/paper/{paper.id}"


@pytest.mark.asyncio
async def test_share_paper_no_auth_required(client: AsyncClient, seeded_papers):
    """인증 헤더 없이도 접근 가능해야 한다."""
    paper = seeded_papers[0]
    resp = await client.get(f"/share/paper/{paper.id}")
    assert resp.status_code == 200


# ──────────────────────────────────────────────
# GET /share/diagnosis/{diagnosis_id} (인증 불필요)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_share_diagnosis_not_found(client: AsyncClient):
    with patch(
        "app.api.share.get_diagnosis",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(f"/share/diagnosis/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_share_diagnosis_success(client: AsyncClient, seeded_papers):
    diagnosis_id = str(uuid.uuid4())
    paper = seeded_papers[0]

    class FakeDiagnosis:
        def __init__(self):
            self.id = diagnosis_id
            self.paper_id = paper.id
            self.overall_score = 85
            self.section_scores = {"introduction": 90, "methodology": 80}
            self.created_at = "2026-04-07T00:00:00Z"

    with patch(
        "app.api.share.get_diagnosis",
        new_callable=AsyncMock,
        return_value=FakeDiagnosis(),
    ):
        resp = await client.get(f"/share/diagnosis/{diagnosis_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["paper_title"] == paper.title
    assert data["overall_score"] == 85
    assert data["section_scores"]["introduction"] == 90
    assert data["share_url"] == f"/share/diagnosis/{diagnosis_id}"


@pytest.mark.asyncio
async def test_share_diagnosis_no_auth_required(client: AsyncClient):
    """인증 헤더 없이도 접근 가능해야 한다."""
    with patch(
        "app.api.share.get_diagnosis",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(f"/share/diagnosis/{uuid.uuid4()}")
    # 404는 OK — 중요한 건 401이 아니라는 것
    assert resp.status_code != 401
