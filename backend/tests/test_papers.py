"""
Tests for the papers API endpoints.

External APIs and Celery tasks are mocked.
DB operations are patched to avoid needing a live PostgreSQL instance.
"""

import datetime
import json
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "papers.json"


@pytest.fixture
def fixture_papers():
    if not FIXTURES_PATH.exists():
        return []
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))


def _make_paper_mock(paper_data: dict, paper_id: uuid.UUID = None):
    mock_paper = MagicMock()
    mock_paper.id = paper_id or uuid.uuid4()
    mock_paper.source = paper_data["source"]
    mock_paper.source_id = paper_data["source_id"]
    mock_paper.title = paper_data["title"]
    mock_paper.abstract = paper_data.get("abstract")
    mock_paper.authors = paper_data.get("authors")
    mock_paper.author_ids = None
    mock_paper.keywords = paper_data.get("keywords")
    mock_paper.published_at = None
    mock_paper.doi = None
    mock_paper.url = None
    mock_paper.pdf_url = None
    mock_paper.citation_count = 0
    mock_paper.summary = None
    mock_paper.metadata_ = None
    mock_paper.created_at = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    mock_paper.updated_at = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    return mock_paper


# ── test_collect_fires_celery_task ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_collect_fires_celery_task(client):
    """POST /api/papers/collect — assert Celery task was called."""
    import app.tasks.collect as collect_module  # ensure module is imported

    fake_task = MagicMock()
    fake_task.id = str(uuid.uuid4())

    with patch.object(
        collect_module.collect_arxiv_papers,
        "apply_async",
        return_value=fake_task,
    ) as mock_apply_async:
        response = await client.post(
            "/api/papers/collect",
            json={"query": "machine learning", "source": "arxiv"},
        )

    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    mock_apply_async.assert_called_once()


@pytest.mark.asyncio
async def test_collect_fires_celery_task_semantic_scholar(client):
    """POST /api/papers/collect with source=semantic_scholar — assert SS task was called."""
    import app.tasks.collect as collect_module  # ensure module is imported

    fake_task = MagicMock()
    fake_task.id = str(uuid.uuid4())

    with patch.object(
        collect_module.collect_semantic_scholar_papers,
        "apply_async",
        return_value=fake_task,
    ) as mock_apply_async:
        response = await client.post(
            "/api/papers/collect",
            json={"query": "transformers", "source": "semantic_scholar"},
        )

    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    mock_apply_async.assert_called_once()


# ── test_search_returns_papers ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_returns_papers(client, fixture_papers):
    """POST /api/papers/search — mock search_similar, assert response contains papers."""
    mock_paper = _make_paper_mock(fixture_papers[0])

    with patch("app.api.papers.get_embedding", return_value=[0.0] * 1536), \
         patch("app.services.paper_service.search_similar", new_callable=AsyncMock, return_value=[mock_paper]):
        response = await client.post(
            "/api/papers/search",
            json={"query": "language models"},
        )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["title"] == fixture_papers[0]["title"]


# ── test_get_paper_by_id ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_paper_by_id(client, fixture_papers):
    """GET /api/papers/{id} — mock get_paper, assert returns paper data."""
    paper_id = uuid.uuid4()
    mock_paper = _make_paper_mock(fixture_papers[1], paper_id=paper_id)

    with patch("app.services.paper_service.get_paper", new_callable=AsyncMock, return_value=mock_paper):
        response = await client.get(f"/api/papers/{paper_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == fixture_papers[1]["title"]
    assert data["source"] == fixture_papers[1]["source"]


@pytest.mark.asyncio
async def test_get_paper_by_id_not_found(client):
    """GET /api/papers/{id} — returns 404 when paper does not exist."""
    paper_id = uuid.uuid4()

    with patch("app.services.paper_service.get_paper", new_callable=AsyncMock, return_value=None):
        response = await client.get(f"/api/papers/{paper_id}")

    assert response.status_code == 404
