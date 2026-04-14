"""research_notes API 엔드포인트 테스트."""

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


class FakeNote:
    def __init__(self, *, note_id=None):
        self.id = note_id or str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())
        self.title = "연구 메모"
        self.content = "LLM 기반 설문 자동생성에 대한 아이디어"
        self.tags = ["LLM", "survey"]
        self.created_at = "2026-04-07T00:00:00Z"
        self.updated_at = "2026-04-07T00:00:00Z"


# ──────────────────────────────────────────────
# POST /notes
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_note_requires_auth(client: AsyncClient):
    resp = await client.post("/notes", json={"title": "test", "content": "body"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_note_success(client: AsyncClient, auth_headers: dict):
    fake = FakeNote()
    with patch(
        "app.api.research_notes.create_note",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.post(
            "/notes",
            json={"title": "연구 메모", "content": "내용"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == fake.id
    assert data["title"] == "연구 메모"


# ──────────────────────────────────────────────
# GET /notes
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_notes_requires_auth(client: AsyncClient):
    resp = await client.get("/notes")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_notes_empty(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.research_notes.list_notes",
        new_callable=AsyncMock,
        return_value=([], 0),
    ):
        resp = await client.get("/notes", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["notes"] == []
    assert data["total"] == 0


# ──────────────────────────────────────────────
# GET /notes/{note_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_note_requires_auth(client: AsyncClient):
    resp = await client.get(f"/notes/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_note_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.research_notes.get_note",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.get(f"/notes/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404
    assert "Note not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_note_success(client: AsyncClient, auth_headers: dict):
    fake = FakeNote()
    with patch(
        "app.api.research_notes.get_note",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.get(f"/notes/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["id"] == fake.id


# ──────────────────────────────────────────────
# PUT /notes/{note_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_note_requires_auth(client: AsyncClient):
    resp = await client.put(f"/notes/{uuid.uuid4()}", json={"title": "new"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_note_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.research_notes.update_note",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.put(
            f"/notes/{uuid.uuid4()}",
            json={"title": "updated"},
            headers=auth_headers,
        )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_note_success(client: AsyncClient, auth_headers: dict):
    fake = FakeNote()
    fake.title = "수정된 제목"
    with patch(
        "app.api.research_notes.update_note",
        new_callable=AsyncMock,
        return_value=fake,
    ):
        resp = await client.put(
            f"/notes/{fake.id}",
            json={"title": "수정된 제목"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    assert resp.json()["title"] == "수정된 제목"


# ──────────────────────────────────────────────
# DELETE /notes/{note_id}
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_note_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/notes/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_note_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.research_notes.get_note",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.delete(f"/notes/{uuid.uuid4()}", headers=auth_headers)

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_note_success(client: AsyncClient, auth_headers: dict):
    fake = FakeNote()
    with patch(
        "app.api.research_notes.get_note",
        new_callable=AsyncMock,
        return_value=fake,
    ), patch(
        "app.api.research_notes.delete_note",
        new_callable=AsyncMock,
    ) as mock_del:
        resp = await client.delete(f"/notes/{fake.id}", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["message"] == "삭제되었습니다"
    mock_del.assert_called_once_with(fake.id)


# ──────────────────────────────────────────────
# POST /notes/to-draft
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_to_draft_requires_auth(client: AsyncClient):
    resp = await client.post("/notes/to-draft", json={"note_id": str(uuid.uuid4())})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_to_draft_note_not_found(client: AsyncClient, auth_headers: dict):
    with patch(
        "app.api.research_notes.get_note",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = await client.post(
            "/notes/to-draft",
            json={"note_id": str(uuid.uuid4())},
            headers=auth_headers,
        )

    assert resp.status_code == 404
    assert "Note not found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_to_draft_success(
    client: AsyncClient, db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    fake = FakeNote()
    token = make_token(user_id)

    with patch("app.api.research_notes.get_note", new_callable=AsyncMock, return_value=fake), \
         patch("app.api.research_notes.get_user", new_callable=AsyncMock, return_value=user), \
         patch("app.api.research_notes.check_quota", new_callable=AsyncMock) as mock_quota, \
         patch("app.api.research_notes.increment_usage", new_callable=AsyncMock) as mock_incr:
        resp = await client.post(
            "/notes/to-draft",
            json={"note_id": fake.id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert "message" in data
    mock_quota.assert_called_once()
    mock_incr.assert_called_once()
