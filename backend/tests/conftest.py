"""
pytest fixtures for academi.ai backend tests.

Uses an in-memory SQLite DB (via aiosqlite) for speed.
When USE_FIXTURES=true the 10 seed papers from fixtures/papers.json are loaded.
"""

import json
import os
import time
import uuid
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
import jwt as pyjwt
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
    """Create all tables once per test session.

    SQLite (used for unit tests) does not support PostgreSQL-specific types such
    as ARRAY, JSONB or pgvector's Vector.  We patch those column types to plain
    SQLAlchemy Text/JSON before running CREATE TABLE, then restore them.
    """
    import sqlalchemy as sa
    from sqlalchemy.dialects.postgresql import ARRAY, JSONB
    from sqlalchemy import Text, JSON

    # Remap unsupported pg types to SQLite-compatible equivalents
    type_overrides: list[tuple] = []
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, ARRAY):
                type_overrides.append((col, col.type))
                col.type = JSON()
            elif isinstance(col.type, JSONB):
                type_overrides.append((col, col.type))
                col.type = JSON()
            else:
                # pgvector Vector type — detected by class name to avoid import errors
                type_name = type(col.type).__name__
                if type_name == "Vector":
                    type_overrides.append((col, col.type))
                    col.type = Text()

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    # Restore original types so other imports remain unaffected
    for col, original_type in type_overrides:
        col.type = original_type


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


# ── httpx mock fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def mock_httpx_get():
    """Mock httpx.get for external API calls in collect tasks."""
    with patch("app.tasks.collect.httpx") as mock_httpx:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}
        mock_httpx.get.return_value = mock_resp
        yield mock_httpx


@pytest.fixture
def mock_arxiv_client():
    """Mock arxiv.Client for collect tasks."""
    with patch("app.tasks.collect.arxiv") as mock_arxiv:
        mock_client = MagicMock()
        mock_arxiv.Client.return_value = mock_client
        mock_arxiv.Search.return_value = MagicMock()
        mock_client.results.return_value = iter([])
        yield mock_arxiv


@pytest.fixture
def mock_anthropic_client():
    """Mock anthropic.Anthropic for process tasks."""
    with patch("app.tasks.process.anthropic") as mock_anthropic:
        mock_client = MagicMock()
        mock_anthropic.Anthropic.return_value = mock_client
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="테스트 요약입니다.")]
        mock_client.messages.create.return_value = mock_message
        yield mock_client


@pytest.fixture
def mock_openai_embedding():
    """Mock OpenAI embedding client for embedding tasks."""
    fake_embedding = [0.0] * 1536
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.data = [MagicMock(embedding=fake_embedding)]
    mock_client.embeddings.create.return_value = mock_resp
    with patch("app.services.embedding_service._get_client", return_value=mock_client):
        yield mock_client


# ── Auth fixtures ────────────────────────────────────────────────────────────

_TEST_SECRET = os.getenv("NEXTAUTH_SECRET", "test-secret")


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Create a test user in the DB and return it."""
    from app.models.users import User

    user = User(
        id=uuid.uuid4(),
        email=f"pay_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="free",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
def auth_headers(test_user):
    """Return HTTP Authorization headers with a valid JWT for test_user."""
    payload = {
        "sub": str(test_user.id),
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    token = pyjwt.encode(payload, _TEST_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}
