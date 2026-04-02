"""
Tests for hybrid and vector-only search endpoints.

All external I/O (DB, Redis, embedding) is mocked.
"""

from __future__ import annotations

import datetime
import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_paper_dict(title: str = "Test Paper", source: str = "arxiv") -> dict:
    """Return a minimal paper dict as returned by search_papers_filtered."""
    return {
        "id": uuid.uuid4(),
        "source": source,
        "source_id": "test-001",
        "title": title,
        "abstract": "An abstract about " + title,
        "authors": ["Author One"],
        "author_ids": None,
        "keywords": None,
        "published_at": datetime.datetime(2022, 1, 1, tzinfo=datetime.timezone.utc),
        "doi": None,
        "url": None,
        "pdf_url": None,
        "citation_count": 0,
        "summary": None,
        "metadata_": None,
        "created_at": datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc),
        "updated_at": datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc),
        "year": 2022,
        "journal": None,
        "embedding": None,
    }


def _make_paper_mock(title: str = "Test Paper", source: str = "arxiv") -> MagicMock:
    """Return a MagicMock Paper object for use with search_papers_filtered."""
    d = _make_paper_dict(title, source)
    mock = MagicMock()
    for k, v in d.items():
        setattr(mock, k, v)
    return mock


def _make_hybrid_result(title: str = "Hybrid Paper", score: float = 0.85) -> dict:
    """Return a hybrid search result dict (includes 'score')."""
    d = _make_paper_dict(title)
    d["score"] = score
    return d


# ---------------------------------------------------------------------------
# test_vector_only_search
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_vector_only_search(client):
    """POST /api/papers/search with hybrid=False calls search_papers_filtered
    and returns the mocked papers."""
    paper1 = _make_paper_mock("Vector Result One")
    paper2 = _make_paper_mock("Vector Result Two")

    with patch("app.api.papers.get_embedding", return_value=[0.0] * 1536), \
         patch(
             "app.services.search_service.search_papers_filtered",
             new_callable=AsyncMock,
             return_value=[paper1, paper2],
         ) as mock_filtered:
        response = await client.post(
            "/api/papers/search",
            json={"query": "neural networks", "hybrid": False},
        )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    titles = [item["title"] for item in data]
    assert "Vector Result One" in titles
    assert "Vector Result Two" in titles
    mock_filtered.assert_called_once()


# ---------------------------------------------------------------------------
# test_hybrid_search_alpha
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hybrid_search_alpha(client):
    """POST /api/papers/search with hybrid=True calls search_papers_hybrid
    and returns the mocked papers."""
    result1 = _make_hybrid_result("Hybrid Paper A", score=0.9)
    result2 = _make_hybrid_result("Hybrid Paper B", score=0.75)

    with patch("app.api.papers.get_embedding", return_value=[0.1] * 1536), \
         patch(
             "app.services.search_service.search_papers_hybrid",
             new_callable=AsyncMock,
             return_value=[result1, result2],
         ) as mock_hybrid:
        response = await client.post(
            "/api/papers/search",
            json={"query": "transformers attention", "hybrid": True},
        )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    titles = [item["title"] for item in data]
    assert "Hybrid Paper A" in titles
    assert "Hybrid Paper B" in titles
    # Verify hybrid was called with alpha=0.7
    call_kwargs = mock_hybrid.call_args.kwargs
    assert call_kwargs.get("alpha") == 0.7


# ---------------------------------------------------------------------------
# test_filter_year_source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_filter_year_source(client):
    """POST /api/papers/search with year_from and source passes those filters
    to the underlying search service."""
    paper = _make_paper_mock("Filtered Paper")

    with patch("app.api.papers.get_embedding", return_value=[0.0] * 1536), \
         patch(
             "app.services.search_service.search_papers_filtered",
             new_callable=AsyncMock,
             return_value=[paper],
         ) as mock_filtered:
        response = await client.post(
            "/api/papers/search",
            json={
                "query": "deep learning",
                "year_from": 2020,
                "source": "arxiv",
                "hybrid": False,
            },
        )

    assert response.status_code == 200
    call_kwargs = mock_filtered.call_args.kwargs
    assert call_kwargs.get("year_from") == 2020
    assert call_kwargs.get("source") == "arxiv"


# ---------------------------------------------------------------------------
# test_cache_miss_then_hit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_miss_then_hit():
    """search_papers_hybrid: first call hits DB (cache miss), second call
    returns cached data without hitting DB again."""
    from app.services import search_service as svc
    from app.services import cache_service

    paper_row = _make_paper_dict("Cached Paper")
    # Simulate hybrid result dicts the function would return
    hybrid_results = [{**paper_row, "score": 0.8}]

    # We'll track how many times the DB is queried by patching db.execute
    db_call_count = 0

    async def fake_db_execute(sql, params=None, **kw):
        nonlocal db_call_count
        db_call_count += 1
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = []
        return mock_result

    mock_db = AsyncMock()
    mock_db.execute.side_effect = fake_db_execute

    # ---------- First call: cache miss → hits DB ----------
    cache_store: dict[str, Any] = {}

    async def fake_cache_get(key: str):
        return cache_store.get(key)

    async def fake_cache_set(key: str, value: Any, ttl: int = 300):
        cache_store[key] = value

    with patch.object(cache_service, "get", side_effect=fake_cache_get), \
         patch.object(cache_service, "set", side_effect=fake_cache_set):

        results_first = await svc.search_papers_hybrid(
            query="cached query",
            query_embedding=[0.0] * 1536,
            db=mock_db,
            limit=5,
        )

    db_calls_after_first = db_call_count

    # ---------- Second call: cache hit → no additional DB calls ----------
    with patch.object(cache_service, "get", side_effect=fake_cache_get), \
         patch.object(cache_service, "set", side_effect=fake_cache_set):

        results_second = await svc.search_papers_hybrid(
            query="cached query",
            query_embedding=[0.0] * 1536,
            db=mock_db,
            limit=5,
        )

    db_calls_after_second = db_call_count

    # DB should not have been called again on the second invocation
    assert db_calls_after_second == db_calls_after_first, (
        f"DB was queried again on cache hit: "
        f"before={db_calls_after_first}, after={db_calls_after_second}"
    )
    # Both calls should return the same (cached) results
    assert results_first == results_second
