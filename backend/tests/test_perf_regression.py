"""
Performance & resilience regression tests.

Covers:
- Alembic migration 0008 loads and defines indexes
- Rerank service graceful fallbacks (no API key, JSON parse error, fixture mode)
- Cache service key builders / Redis DB separation
- Celery export task retry configuration
- Database pool configuration
"""

from __future__ import annotations

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Alembic migration 0008 ────────────────────────────────────────────────────


def test_migration_0008_uses_autocommit_block_for_concurrently():
    """CONCURRENTLY statements must run inside get_context().autocommit_block()
    since Alembic wraps migrations in a transaction by default.
    """
    from pathlib import Path

    migration_path = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "0008_add_performance_indexes.py"
    )
    src = migration_path.read_text(encoding="utf-8")

    # If CONCURRENTLY appears, it MUST be wrapped in autocommit_block
    if "CONCURRENTLY" in src:
        assert "autocommit_block()" in src, (
            "CREATE/DROP INDEX CONCURRENTLY must be wrapped in "
            "op.get_context().autocommit_block() to avoid "
            "'cannot run inside a transaction block' error in PostgreSQL."
        )


def test_migration_0008_has_expected_indexes():
    """0008 must create the performance indexes we rely on."""
    from pathlib import Path

    src = (
        Path(__file__).parent.parent
        / "alembic"
        / "versions"
        / "0008_add_performance_indexes.py"
    ).read_text(encoding="utf-8")

    expected_indexes = [
        "ix_papers_published_at",
        "ix_papers_source",
        "ix_papers_title_trgm",
        "ix_payments_user_id_status",
        "ix_paper_versions_user_id",
    ]
    for name in expected_indexes:
        assert name in src, f"missing index: {name}"


# ── Rerank service graceful fallbacks ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_rerank_empty_papers_returns_empty_list():
    """Empty papers input short-circuits to empty result (no API call)."""
    from app.services.rerank_service import rerank_papers

    result = await rerank_papers("any query", [], top_k=5)
    assert result == []


@pytest.mark.asyncio
async def test_rerank_missing_api_key_returns_fallback():
    """Missing ANTHROPIC_API_KEY returns papers with score=0.5 + explanatory reason."""
    from app.core.config import get_settings

    get_settings.cache_clear()
    with patch("app.services.rerank_service.get_settings") as mock_settings:
        cfg = MagicMock()
        cfg.use_fixtures = False
        cfg.anthropic_api_key = ""
        mock_settings.return_value = cfg

        from app.services.rerank_service import rerank_papers

        papers = [
            {"id": "1", "title": "A", "abstract": "x"},
            {"id": "2", "title": "B", "abstract": "y"},
        ]
        result = await rerank_papers("query", papers, top_k=5)

    assert len(result) == 2
    for paper in result:
        assert paper["rerank_score"] == 0.5
        assert "not configured" in paper["rerank_reason"].lower()

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_rerank_top_k_limits_output():
    """top_k must limit output length even in fixture mode."""
    from app.core.config import get_settings

    get_settings.cache_clear()
    with patch("app.services.rerank_service.get_settings") as mock_settings:
        cfg = MagicMock()
        cfg.use_fixtures = True
        cfg.anthropic_api_key = ""
        mock_settings.return_value = cfg

        from app.services.rerank_service import rerank_papers

        papers = [{"id": str(i), "title": f"P{i}", "abstract": ""} for i in range(10)]
        result = await rerank_papers("q", papers, top_k=3)

    assert len(result) == 3
    get_settings.cache_clear()


# ── Cache service ─────────────────────────────────────────────────────────────


def test_cache_search_key_is_deterministic():
    """Same inputs must produce the same cache key."""
    from app.services.cache_service import search_cache_key

    k1 = search_cache_key("neural networks", 2020, 2024, "arxiv")
    k2 = search_cache_key("neural networks", 2020, 2024, "arxiv")
    assert k1 == k2


def test_cache_search_key_differs_on_filters():
    """Different filters must yield different cache keys."""
    from app.services.cache_service import search_cache_key

    base = search_cache_key("ml", 2020, 2024, "arxiv")
    assert search_cache_key("ml", 2021, 2024, "arxiv") != base
    assert search_cache_key("ml", 2020, 2023, "arxiv") != base
    assert search_cache_key("ml", 2020, 2024, "semantic_scholar") != base
    assert search_cache_key("different", 2020, 2024, "arxiv") != base


def test_cache_uses_separate_redis_db_from_broker():
    """Cache Redis URL must NOT be DB 0 (reserved for Celery broker)."""
    from app.services.cache_service import _cache_redis_url

    # When settings default is redis://localhost:6379/0, cache should switch to /2
    url = _cache_redis_url()
    assert not url.endswith("/0"), (
        "cache must not share DB 0 with Celery broker — use a separate Redis DB"
    )


def test_cache_user_plan_key_includes_user_id():
    from app.services.cache_service import user_plan_key

    key1 = user_plan_key("abc-123")
    key2 = user_plan_key("xyz-456")
    assert "abc-123" in key1
    assert "xyz-456" in key2
    assert key1 != key2


def test_cache_ttls_are_sensible():
    from app.services.cache_service import TTL_SEARCH, TTL_USER, TTL_META

    assert TTL_SEARCH > 0
    assert TTL_USER > 0
    assert TTL_META > 0
    # User plan data should be cached longer than search results
    assert TTL_USER >= TTL_SEARCH


# ── Celery task retry configuration ───────────────────────────────────────────


def test_export_markdown_has_retry_backoff():
    """export_research_markdown must have retry_backoff configured
    so transient S3/network failures don't immediately fail the job.
    """
    from app.tasks.export import export_research_markdown

    # Celery stores task options on the task instance
    task = export_research_markdown
    assert task.max_retries == 3
    # retry_backoff True enables exponential backoff
    assert getattr(task, "retry_backoff", False) is True


def test_export_pdf_has_retry_backoff():
    from app.tasks.export import export_research_pdf

    task = export_research_pdf
    assert task.max_retries == 3
    assert getattr(task, "retry_backoff", False) is True


def test_process_tasks_have_retry_backoff():
    """Core processing tasks must have exponential backoff for resilience."""
    from app.tasks.process import summarize_paper, embed_paper, generate_survey_questions

    for task in (summarize_paper, embed_paper, generate_survey_questions):
        assert task.max_retries == 3, f"{task.name} must have max_retries=3"
        assert getattr(task, "retry_backoff", False) is True, (
            f"{task.name} must have retry_backoff=True"
        )


def test_collect_tasks_have_retry_backoff():
    from app.tasks.collect import (
        collect_arxiv_papers,
        collect_semantic_scholar_papers,
    )

    for task in (collect_arxiv_papers, collect_semantic_scholar_papers):
        assert task.max_retries == 5, f"{task.name} must have max_retries=5"
        assert getattr(task, "retry_backoff", False) is True


# ── Database pool configuration ───────────────────────────────────────────────


def test_db_engine_uses_connection_pool():
    """Production engine must use a real connection pool, not NullPool."""
    from app.core.database import engine

    # NullPool.__class__.__name__ == 'NullPool'
    pool_name = type(engine.pool).__name__
    assert pool_name != "NullPool", (
        "Production engine should NOT use NullPool — use default QueuePool or AsyncAdaptedQueuePool"
    )


def test_db_engine_has_pool_pre_ping():
    """pool_pre_ping avoids 'connection closed' errors after idle periods."""
    from app.core.database import engine

    assert engine.pool._pre_ping is True


# ── Config sanity ─────────────────────────────────────────────────────────────


def test_use_fixtures_defaults_to_false():
    """USE_FIXTURES MUST default to False so production never serves fixture data."""
    from app.core.config import Settings

    # Read field default directly (avoids env-var pollution from other tests)
    default = Settings.model_fields["use_fixtures"].default
    assert default is False, (
        "use_fixtures default must be False — production must NEVER serve fixtures"
    )


def test_debug_defaults_to_false():
    from app.core.config import Settings

    default = Settings.model_fields["debug"].default
    assert default is False
