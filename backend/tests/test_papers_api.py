from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.paper import Paper


@pytest.fixture
def auth_headers():
    from jose import jwt

    from app.core.config import settings

    token = jwt.encode({"sub": "test-user-id"}, settings.NEXTAUTH_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


# --- GET /papers/search ---


@pytest.mark.asyncio
async def test_search_papers_requires_auth(client: AsyncClient):
    resp = await client.get("/papers/search", params={"q": "transformer"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_papers_returns_results(client: AsyncClient, seeded_papers, auth_headers):
    resp = await client.get("/papers/search", params={"q": "transformer"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_search_papers_empty(client: AsyncClient, seeded_papers, auth_headers):
    resp = await client.get(
        "/papers/search", params={"q": "nonexistent_xyz_query"}, headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_search_papers_pagination(client: AsyncClient, seeded_papers, auth_headers):
    resp = await client.get(
        "/papers/search", params={"q": "a", "page": 1, "size": 3}, headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 3
    assert data["size"] == 3


@pytest.mark.asyncio
async def test_search_papers_query_required(client: AsyncClient, auth_headers):
    resp = await client.get("/papers/search", headers=auth_headers)
    assert resp.status_code == 422


# --- GET /papers/{paper_id} ---


@pytest.mark.asyncio
async def test_get_paper_not_found(client: AsyncClient, auth_headers):
    resp = await client.get("/papers/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_paper_success(client: AsyncClient, seeded_papers, auth_headers):
    paper = seeded_papers[0]

    mock_summary = {
        "paper_id": paper.id,
        "title": paper.title,
        "summary_ko": "테스트 요약",
        "key_findings": ["발견1"],
        "methodology": "방법론",
        "limitations": "한계",
    }

    with patch(
        "app.api.papers.do_summarize",
        new_callable=AsyncMock,
        return_value=type("Obj", (), mock_summary)(),
    ):
        resp = await client.get(f"/papers/{paper.id}", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == paper.id
    assert data["title"] == paper.title


@pytest.mark.asyncio
async def test_get_paper_requires_auth(client: AsyncClient, seeded_papers):
    paper = seeded_papers[0]
    resp = await client.get(f"/papers/{paper.id}")
    assert resp.status_code == 401


# --- POST /papers/collect ---


@pytest.mark.asyncio
async def test_collect_requires_auth(client: AsyncClient):
    resp = await client.post("/papers/collect", json={"keyword": "NLP"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_collect_triggers_task(client: AsyncClient, auth_headers):
    mock_task = type("Task", (), {"id": "fake-task-id"})()
    with patch("app.api.papers.collect_papers") as mock_collect:
        mock_collect.delay.return_value = mock_task
        resp = await client.post("/papers/collect", json={"keyword": "NLP"}, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["task_id"] == "fake-task-id"
    assert data["status"] == "queued"
    mock_collect.delay.assert_called_once()


# --- GET /papers/similar/{paper_id} ---


@pytest.mark.asyncio
async def test_similar_not_found(client: AsyncClient, auth_headers):
    resp = await client.get(
        "/papers/similar/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_similar_no_embedding(client: AsyncClient, seeded_papers, auth_headers):
    paper = seeded_papers[0]
    resp = await client.get(f"/papers/similar/{paper.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["paper_id"] == paper.id
    assert data["items"] == []


@pytest.mark.asyncio
async def test_similar_requires_auth(client: AsyncClient, seeded_papers):
    paper = seeded_papers[0]
    resp = await client.get(f"/papers/similar/{paper.id}")
    assert resp.status_code == 401
