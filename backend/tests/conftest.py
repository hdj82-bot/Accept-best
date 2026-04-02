"""
pytest fixtures for academi.ai backend tests.

Uses an in-memory SQLite DB (via aiosqlite) for speed.
When USE_FIXTURES=true the 10 seed papers from fixtures/papers.json are loaded.
"""

import json
import os
import uuid
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.models.base import Base

# ── DB fixtures ───────────────────────────────────────────────────────────────

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:"
)

_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
_TestingSessionLocal = async_sessionmaker(
    bind=_engine, expire_on_commit=False, class_=AsyncSession
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once per test session."""
    async with _engine.begin() as conn:
        # SQLite doesn't support pgvector; skip the Vector column for unit tests
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh transactional session, rolled back after each test."""
    async with _TestingSessionLocal() as session:
        async with session.begin():
            yield session
            await session.rollback()


# ── Seed fixtures ─────────────────────────────────────────────────────────────

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "papers.json"


@pytest_asyncio.fixture
async def seed_papers(db_session: AsyncSession):
    """
    Load 10 seed papers from fixtures/papers.json into the test DB.
    Only runs when USE_FIXTURES env var is truthy (default: true in development).
    """
    if os.getenv("USE_FIXTURES", "true").lower() not in ("1", "true", "yes"):
        return []

    if not FIXTURES_PATH.exists():
        return []

    from app.models.papers import Paper

    raw = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    papers = []
    for item in raw[:10]:
        paper = Paper(
            id=uuid.UUID(item["id"]) if "id" in item else uuid.uuid4(),
            source=item.get("source", "arxiv"),
            source_id=item.get("source_id", str(uuid.uuid4())),
            title=item.get("title", ""),
            abstract=item.get("abstract"),
            authors=item.get("authors"),
            keywords=item.get("keywords"),
        )
        db_session.add(paper)
        papers.append(paper)

    await db_session.flush()
    return papers


# ── HTTP client ───────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """ASGI test client wrapping the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
