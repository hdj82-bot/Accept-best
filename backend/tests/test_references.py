"""references API 엔드포인트 테스트."""

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


class FakeReference:
    def __init__(self, *, ref_id=None):
        self.id = ref_id or str(uuid.uuid4())
        self.paper_id = str(uuid.uuid4())
        self.title = "Attention Is All You Need"
        self.authors = ["Vaswani, A."]
        self.year = 2017
        self.journal = "NeurIPS"
        self.doi = "10.48550/arXiv.1706.03762"
        self.created_at = "2026-04-07T00:00:00Z"


# ──────────────────────────────────────────────
# POST /references
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_reference_requires_auth(client: AsyncClient):
    resp = await client.post("/api/references", json={"title": "test"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_reference_success(client: AsyncClient, auth_headers: dict):
    fake = FakeReference()
    with patch(
        "app.api.references.create_reference",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.post(
            "/api/references",
            json={"paper_id": fake.paper_id, "title": "Attention Is All You Need"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == fake.id
    assert data["title"] == "Attention Is All You Need"


# ──────────────────────────────────────────────
# GET /references
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_references_requires_auth(client: AsyncClient):
    resp = await client.get("/api/references")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_references_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.references.list_references",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/api/references", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["references"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_references_with_paper_id(client: AsyncClient, auth_headers: dict):
    fake_paper_id = str(uuid.uuid4())
    with patch(
        "app.api.references.list_references",
        new_callable=AsyncMock,
        return_value=([], 0),
    ) as mock_list:
        resp = await client.get(
            f"/api/references?paper_id={fake_paper_id}", headers=auth_headers,
        )

    assert resp.status_code == 200
    mock_list.assert_called_once_with(
        paper_id=fake_paper_id, limit=20, offset=0,
    )


# ──────────────────────────────────────────────
# GET /references/{ref_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_reference_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/references/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_reference_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.references.get_reference",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(f"/api/references/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404
    assert "Reference not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_reference_success(client: AsyncClient, auth_headers: dict):
    fake = FakeReference()
    with patch(
        "app.api.references.get_reference",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.get(f"/api/references/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["id"] == fake.id


# ──────────────────────────────────────────────
# PUT /references/{ref_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_reference_requires_auth(client: AsyncClient):
    resp = await client.put(f"/api/references/{uuid.uuid4()}", json={"title": "new"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_reference_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.references.update_reference",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.put(
            f"/api/references/{uuid.uuid4()}",
            json={"title": "updated"},
            headers=auth_headers,
        )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_reference_success(client: AsyncClient, auth_headers: dict):
    fake = FakeReference()
    fake.title = "Updated Title"
    with patch(
        "app.api.references.update_reference",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.put(
            f"/api/references/{fake.id}",
            json={"title": "Updated Title"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


# ──────────────────────────────────────────────
# DELETE /references/{ref_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_reference_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/api/references/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_reference_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.references.get_reference",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.delete(f"/api/references/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_reference_success(client: AsyncClient, auth_headers: dict):
    fake = FakeReference()
    with patch(
        "app.api.references.get_reference",
        new_callable=AsyncMock,
        return_value=fake,
    ), patch(
        "app.api.references.delete_reference",
        new_callable=AsyncMock,
    ) as mock_del:
        resp = await client.delete(f"/api/references/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["message"] == "삭제되었습니다"
    mock_del.assert_called_once_with(fake.id)


# ──────────────────────────────────────────────
# POST /references/extract
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_requires_auth(client: AsyncClient):
    resp = await client.post("/api/references/extract", json={"paper_id": str(uuid.uuid4())})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_extract_paper_not_found(
    client: AsyncClient, db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    resp = await client.post(
        "/api/references/extract",
        json={"paper_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert "Paper not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_extract_success(
    client: AsyncClient, db_session: AsyncSession, seeded_papers,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    paper_id = seeded_papers[0].id
    token = make_token(user_id)

    with patch("app.api.references.get_user", new_callable=AsyncMock, return_value=user), \
         patch("app.api.references.check_quota", new_callable=AsyncMock) as mock_quota, \
         patch("app.api.references.increment_usage", new_callable=AsyncMock) as mock_incr:
        resp = await client.post(
            "/api/references/extract",
            json={"paper_id": paper_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert "message" in data
    mock_quota.assert_called_once()
    mock_incr.assert_called_once()
