"""
Tests for the References feature (model, service, API).

Service-layer tests use db_session directly.
HTTP-layer tests use the ASGI client with dependency overrides for auth.
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
from app.models.bookmark import Bookmark
from app.models.papers import Paper
from app.models.reference import Reference
from app.models.users import User
from app.schemas.reference import ReferenceCreate, ReferenceUpdate
from app.services.reference_service import (
    create_reference,
    delete_reference,
    export_bibtex,
    list_references,
    update_reference,
)


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"reftest_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="free",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def other_user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"other_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="free",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def reference(db_session: AsyncSession, user: User) -> Reference:
    return await create_reference(
        user_id=str(user.id),
        data=ReferenceCreate(
            title="Attention Is All You Need",
            authors="Vaswani et al.",
            journal="NeurIPS",
            year=2017,
            doi="10.48550/arXiv.1706.03762",
            cite_key="vaswani2017attention",
        ),
        db=db_session,
    )


@pytest_asyncio.fixture
async def authed_client(user: User):
    """HTTP client with get_current_user overridden to return this user's ID."""
    app.dependency_overrides[get_current_user] = lambda: str(user.id)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_current_user, None)


@pytest_asyncio.fixture
async def authed_db_client(user: User, db_session: AsyncSession):
    """HTTP client with both auth and get_db overridden to share the test session.

    This ensures data flushed (but not committed) via db_session is visible
    to the endpoint under test, which receives the same AsyncSession instance.
    """
    async def _get_db_override():
        yield db_session

    app.dependency_overrides[get_current_user] = lambda: str(user.id)
    app.dependency_overrides[get_db] = _get_db_override
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


# ── Service layer: CRUD ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_reference(db_session: AsyncSession, user: User):
    ref = await create_reference(
        user_id=str(user.id),
        data=ReferenceCreate(title="Deep Learning", authors="LeCun et al.", year=2015),
        db=db_session,
    )
    assert ref.id is not None
    assert ref.title == "Deep Learning"
    assert ref.authors == "LeCun et al."
    assert ref.year == 2015
    assert ref.user_id == user.id


@pytest.mark.asyncio
async def test_list_references_empty(db_session: AsyncSession, user: User):
    refs = await list_references(str(user.id), db_session)
    assert isinstance(refs, list)


@pytest.mark.asyncio
async def test_list_references_with_data(
    db_session: AsyncSession, user: User, reference: Reference
):
    refs = await list_references(str(user.id), db_session)
    assert any(r.id == reference.id for r in refs)


@pytest.mark.asyncio
async def test_list_references_ordered_by_created_at_desc(
    db_session: AsyncSession, user: User
):
    r1 = await create_reference(
        str(user.id), ReferenceCreate(title="First"), db_session
    )
    r2 = await create_reference(
        str(user.id), ReferenceCreate(title="Second"), db_session
    )
    refs = await list_references(str(user.id), db_session)
    ids = [r.id for r in refs]
    assert ids.index(r2.id) < ids.index(r1.id)


@pytest.mark.asyncio
async def test_update_reference(
    db_session: AsyncSession, user: User, reference: Reference
):
    updated = await update_reference(
        ref_id=reference.id,
        user_id=str(user.id),
        data=ReferenceUpdate(note="Must cite"),
        db=db_session,
    )
    assert updated is not None
    assert updated.note == "Must cite"
    assert updated.title == reference.title  # unchanged


@pytest.mark.asyncio
async def test_update_reference_not_found(db_session: AsyncSession, user: User):
    result = await update_reference(
        ref_id=uuid.uuid4(),
        user_id=str(user.id),
        data=ReferenceUpdate(note="x"),
        db=db_session,
    )
    assert result is None


@pytest.mark.asyncio
async def test_update_reference_wrong_owner(
    db_session: AsyncSession, other_user: User, reference: Reference
):
    result = await update_reference(
        ref_id=reference.id,
        user_id=str(other_user.id),
        data=ReferenceUpdate(note="x"),
        db=db_session,
    )
    assert result is None


@pytest.mark.asyncio
async def test_delete_reference(
    db_session: AsyncSession, user: User, reference: Reference
):
    ok = await delete_reference(reference.id, str(user.id), db_session)
    assert ok is True
    refs = await list_references(str(user.id), db_session)
    assert not any(r.id == reference.id for r in refs)


@pytest.mark.asyncio
async def test_delete_reference_not_found(db_session: AsyncSession, user: User):
    ok = await delete_reference(uuid.uuid4(), str(user.id), db_session)
    assert ok is False


@pytest.mark.asyncio
async def test_delete_reference_wrong_owner(
    db_session: AsyncSession, other_user: User, reference: Reference
):
    ok = await delete_reference(reference.id, str(other_user.id), db_session)
    assert ok is False


# ── Service layer: BibTeX export ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_bibtex_empty(db_session: AsyncSession, user: User):
    bibtex = await export_bibtex(str(user.id), db_session)
    assert bibtex == ""


@pytest.mark.asyncio
async def test_export_bibtex_single(
    db_session: AsyncSession, user: User, reference: Reference
):
    bibtex = await export_bibtex(str(user.id), db_session)
    assert "@article{vaswani2017attention," in bibtex
    assert "title={Attention Is All You Need}" in bibtex
    assert "author={Vaswani et al.}" in bibtex
    assert "year={2017}" in bibtex
    assert "doi={10.48550/arXiv.1706.03762}" in bibtex


@pytest.mark.asyncio
async def test_export_bibtex_multiple_entries_separated_by_blank_line(
    db_session: AsyncSession, user: User
):
    await create_reference(str(user.id), ReferenceCreate(title="Paper A", year=2020), db_session)
    await create_reference(str(user.id), ReferenceCreate(title="Paper B", year=2021), db_session)
    bibtex = await export_bibtex(str(user.id), db_session)
    assert bibtex.count("@article{") == 2
    assert "\n\n" in bibtex


@pytest.mark.asyncio
async def test_export_bibtex_auto_cite_key(db_session: AsyncSession, user: User):
    ref = await create_reference(
        str(user.id),
        ReferenceCreate(title="No Key Paper"),  # no cite_key
        db_session,
    )
    bibtex = await export_bibtex(str(user.id), db_session)
    expected_key = f"ref_{str(ref.id)[:8]}"
    assert f"@article{{{expected_key}," in bibtex


# ── HTTP layer: auth & validation ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_references_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/references/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_reference_missing_title(authed_client: AsyncClient):
    resp = await authed_client.post("/api/references/", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_reference_via_http(authed_client: AsyncClient):
    resp = await authed_client.post(
        "/api/references/",
        json={"title": "HTTP Test Paper", "year": 2024},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "HTTP Test Paper"
    assert data["year"] == 2024
    assert "id" in data


@pytest.mark.asyncio
async def test_update_reference_via_http_not_found(authed_client: AsyncClient):
    resp = await authed_client.patch(
        f"/api/references/{uuid.uuid4()}",
        json={"note": "test"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_reference_unauthenticated(client: AsyncClient):
    resp = await client.delete(f"/api/references/{uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_bibtex_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/references/export/bibtex")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_bibtex_via_http(authed_client: AsyncClient):
    await authed_client.post(
        "/api/references/",
        json={"title": "BibTeX Test", "cite_key": "bibtextest2024"},
    )
    resp = await authed_client.get("/api/references/export/bibtex")
    assert resp.status_code == 200
    assert "bibtextest2024" in resp.text
    assert resp.headers["content-type"].startswith("text/plain")


# ── HTTP layer: import from bookmarks ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_from_bookmarks_no_bookmarks(
    authed_client: AsyncClient,
):
    """북마크가 없을 때 imported=0, skipped=0."""
    resp = await authed_client.post("/api/references/import/bookmarks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported"] == 0
    assert data["skipped"] == 0


@pytest.mark.asyncio
async def test_import_skips_duplicate_doi(
    authed_db_client: AsyncClient,
    db_session: AsyncSession,
    user: User,
):
    """같은 doi를 가진 참고문헌이 이미 있으면 skipped 카운트.

    authed_db_client shares db_session with the endpoint, so flushed data is
    visible to the import query without a full commit.
    """
    paper = Paper(
        id=uuid.uuid4(),
        source="arxiv",
        source_id=f"import-{uuid.uuid4().hex[:8]}",
        title="Transformer Paper",
        doi="10.48550/arXiv.1706.03762",
        year=2017,
    )
    db_session.add(paper)
    bm = Bookmark(user_id=user.id, paper_id=paper.id)
    db_session.add(bm)
    await db_session.flush()

    # 첫 번째 import → imported=1 (참고문헌 생성됨)
    resp1 = await authed_db_client.post("/api/references/import/bookmarks")
    assert resp1.status_code == 200
    assert resp1.json()["imported"] == 1
    assert resp1.json()["skipped"] == 0

    # 두 번째 import → skipped=1 (같은 doi 이미 존재)
    resp2 = await authed_db_client.post("/api/references/import/bookmarks")
    assert resp2.status_code == 200
    assert resp2.json()["imported"] == 0
    assert resp2.json()["skipped"] == 1
