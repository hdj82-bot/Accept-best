"""paper_versions API 엔드포인트 테스트."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.config import settings
from jose import jwt


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, settings.NEXTAUTH_SECRET, algorithm="HS256")


class FakeVersion:
    def __init__(self, *, version_id=None, version_type="manual"):
        self.id = version_id or str(uuid.uuid4())
        self.user_id = "test-user-001"
        # version_type 매개변수는 delete 분기 (paper_versions.py:64) 호환을 위해 유지.
        # 모델/스키마는 save_type 만 보유하므로 두 속성을 동일 값으로 설정.
        self.version_type = version_type
        self.save_type = version_type
        self.content = {"text": "논문 본문 내용"}
        self.created_at = "2026-04-07T00:00:00Z"


# ──────────────────────────────────────────────
# POST /versions
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_version_requires_auth(client: AsyncClient):
    resp = await client.post("/api/versions", json={"paper_id": "any", "label": "v1"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_version_success(client: AsyncClient, auth_headers: dict):
    fake = FakeVersion()
    with patch(
        "app.api.paper_versions.save_version",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.post(
            "/api/versions",
            json={"content": {"text": "본문"}, "save_type": "manual"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == fake.id
    assert data["save_type"] == "manual"


# ──────────────────────────────────────────────
# GET /versions
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_versions_requires_auth(client: AsyncClient):
    resp = await client.get("/api/versions")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_versions_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.paper_versions.list_versions",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/api/versions", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["versions"] == []
    assert data["total"] == 0


# ──────────────────────────────────────────────
# GET /versions/{version_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_version_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/versions/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_version_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.paper_versions.get_version",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(f"/api/versions/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404
    assert "Version not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_version_success(client: AsyncClient, auth_headers: dict):
    fake = FakeVersion()
    with patch(
        "app.api.paper_versions.get_version",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.get(f"/api/versions/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["id"] == fake.id


# ──────────────────────────────────────────────
# DELETE /versions/{version_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_version_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/api/versions/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_version_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.paper_versions.get_version",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.delete(f"/api/versions/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_auto_version_rejected(client: AsyncClient, auth_headers: dict):
    """auto 타입 버전은 삭제할 수 없다."""
    fake = FakeVersion(version_type="auto")
    with patch(
        "app.api.paper_versions.get_version",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.delete(f"/api/versions/{fake.id}", headers=auth_headers)

    assert resp.status_code == 400
    assert "자동 저장" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_manual_version_success(client: AsyncClient, auth_headers: dict):
    """manual 타입 버전은 삭제 가능하다."""
    fake = FakeVersion(version_type="manual")
    with patch(
        "app.api.paper_versions.get_version",
        new_callable=AsyncMock,
        return_value=fake,
    ), patch(
        "app.api.paper_versions.delete_version",
        new_callable=AsyncMock,
    ) as mock_del:
        resp = await client.delete(f"/api/versions/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["message"] == "삭제되었습니다"
    mock_del.assert_called_once_with(fake.id)
