"""
Tests for the research gap analysis feature.
POST /research/{note_id}/gap-analysis — pro plan only.
"""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("USE_FIXTURES", "true")

from app.core.auth import get_current_user
from app.core.database import get_db
from app.main import app
from app.models.research_notes import ResearchNote
from app.models.users import User


# ── local fixtures ────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def free_user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"free_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="free",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def basic_user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"basic_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="basic",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def pro_user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"pro_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="pro",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def pro_note(db_session: AsyncSession, pro_user: User) -> ResearchNote:
    note = ResearchNote(
        id=uuid.uuid4(),
        user_id=pro_user.id,
        content="연구 노트 내용입니다.",
    )
    db_session.add(note)
    await db_session.flush()
    return note


def _make_authed_client(user: User, db_session: AsyncSession):
    """Return a context-managed ASGI client with auth + db overridden."""
    async def _get_db_override():
        yield db_session

    app.dependency_overrides[get_current_user] = lambda: str(user.id)
    app.dependency_overrides[get_db] = _get_db_override
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_gap_analysis_pro_user(pro_user: User, pro_note: ResearchNote, db_session: AsyncSession):
    """pro 플랜 유저 → 200, gaps 키 존재, gaps는 list."""
    async with _make_authed_client(pro_user, db_session) as ac:
        resp = await ac.post(f"/research/{pro_note.id}/gap-analysis")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    data = resp.json()
    assert "gaps" in data
    assert isinstance(data["gaps"], list)


@pytest.mark.asyncio
async def test_gap_analysis_free_user_forbidden(free_user: User, db_session: AsyncSession):
    """free 플랜 유저 → 403."""
    note_id = uuid.uuid4()
    async with _make_authed_client(free_user, db_session) as ac:
        resp = await ac.post(f"/research/{note_id}/gap-analysis")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_gap_analysis_basic_user_forbidden(basic_user: User, db_session: AsyncSession):
    """basic 플랜 유저 → 403."""
    note_id = uuid.uuid4()
    async with _make_authed_client(basic_user, db_session) as ac:
        resp = await ac.post(f"/research/{note_id}/gap-analysis")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_gap_analysis_nonexistent_note(pro_user: User, db_session: AsyncSession):
    """존재하지 않는 note_id → fixture 결과(200) 또는 404."""
    note_id = uuid.uuid4()
    async with _make_authed_client(pro_user, db_session) as ac:
        resp = await ac.post(f"/research/{note_id}/gap-analysis")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_gap_analysis_returns_opportunities(pro_user: User, pro_note: ResearchNote, db_session: AsyncSession):
    """결과에 opportunities 키 존재, list 타입."""
    async with _make_authed_client(pro_user, db_session) as ac:
        resp = await ac.post(f"/research/{pro_note.id}/gap-analysis")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 200
    data = resp.json()
    assert "opportunities" in data
    assert isinstance(data["opportunities"], list)


@pytest.mark.asyncio
async def test_gap_analysis_unauthenticated(client: AsyncClient):
    """인증 없음 → 401."""
    note_id = uuid.uuid4()
    resp = await client.post(f"/research/{note_id}/gap-analysis")
    assert resp.status_code == 401
