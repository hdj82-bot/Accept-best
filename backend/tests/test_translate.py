"""
Tests for DeepL translation service and /translate endpoints.
"""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("USE_FIXTURES", "true")

from app.models.papers import Paper
from app.services.translate_service import translate_paper, translate_text


# ── service-layer tests ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_translate_text_fixture_returns_dict():
    result = await translate_text("Hello world")
    assert isinstance(result, dict)
    assert "translated_text" in result


@pytest.mark.asyncio
async def test_translate_text_fixture_flag():
    result = await translate_text("Hello world")
    assert result.get("fixture") is True


@pytest.mark.asyncio
async def test_translate_paper_not_found(db_session: AsyncSession):
    result = await translate_paper("00000000-0000-0000-0000-000000000000", db_session)
    assert "error" in result


@pytest_asyncio.fixture
async def fixture_paper(db_session: AsyncSession) -> Paper:
    paper = Paper(
        id=uuid.uuid4(),
        source="arxiv",
        source_id=f"test-{uuid.uuid4().hex[:8]}",
        title="Attention Is All You Need",
        abstract="We propose a new simple network architecture, the Transformer.",
    )
    db_session.add(paper)
    await db_session.flush()
    return paper


@pytest.mark.asyncio
async def test_translate_paper_with_fixture_paper(
    fixture_paper: Paper, db_session: AsyncSession
):
    result = await translate_paper(str(fixture_paper.id), db_session)
    assert "title_ko" in result
    assert "abstract_ko" in result


# ── HTTP-layer test ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_translate_text_endpoint_no_auth(client: AsyncClient):
    resp = await client.post("/api/translate/text", json={"text": "Hello"})
    assert resp.status_code == 401
