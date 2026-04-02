"""
Tests for collections, collection_papers, and paper_tags.

Uses the shared in-memory SQLite fixtures from conftest.py.
All service functions are tested directly against the test DB session.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection, CollectionPaper, PaperTag
from app.models.papers import Paper
from app.models.users import User
from app.services.collection_service import (
    add_paper,
    add_tag,
    create_collection,
    delete_collection,
    get_collection_papers,
    get_paper_tags,
    list_all_tags,
    list_by_tag,
    list_collections,
    remove_paper,
    remove_tag,
)


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"test_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="free",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture
async def paper(db_session: AsyncSession) -> Paper:
    p = Paper(
        id=uuid.uuid4(),
        source="arxiv",
        source_id=f"test-{uuid.uuid4().hex[:8]}",
        title="Test Paper for Collections",
    )
    db_session.add(p)
    await db_session.flush()
    return p


@pytest_asyncio.fixture
async def collection(db_session: AsyncSession, user: User) -> Collection:
    col = await create_collection(
        user_id=str(user.id),
        name="My Collection",
        description="A test collection",
        color="#4f46e5",
        db=db_session,
    )
    return col


# ── Collection CRUD ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_collection(db_session: AsyncSession, user: User):
    col = await create_collection(
        user_id=str(user.id),
        name="Research 2026",
        description="Papers for thesis",
        color="#059669",
        db=db_session,
    )
    assert col.id is not None
    assert col.name == "Research 2026"
    assert col.color == "#059669"
    assert col.user_id == user.id


@pytest.mark.asyncio
async def test_list_collections_empty(db_session: AsyncSession, user: User):
    cols = await list_collections(str(user.id), db_session)
    assert isinstance(cols, list)


@pytest.mark.asyncio
async def test_list_collections_with_data(
    db_session: AsyncSession, user: User, collection: Collection
):
    cols = await list_collections(str(user.id), db_session)
    assert any(c["id"] == str(collection.id) for c in cols)
    col_data = next(c for c in cols if c["id"] == str(collection.id))
    assert col_data["paper_count"] == 0


@pytest.mark.asyncio
async def test_delete_collection(
    db_session: AsyncSession, user: User, collection: Collection
):
    ok = await delete_collection(collection.id, str(user.id), db_session)
    assert ok is True


@pytest.mark.asyncio
async def test_delete_collection_not_found(db_session: AsyncSession, user: User):
    ok = await delete_collection(uuid.uuid4(), str(user.id), db_session)
    assert ok is False


@pytest.mark.asyncio
async def test_delete_collection_wrong_owner(
    db_session: AsyncSession, collection: Collection
):
    other_user_id = str(uuid.uuid4())
    ok = await delete_collection(collection.id, other_user_id, db_session)
    assert ok is False


# ── Collection papers ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_and_get_paper(
    db_session: AsyncSession,
    user: User,
    collection: Collection,
    paper: Paper,
):
    cp = await add_paper(collection.id, paper.id, str(user.id), db_session)
    assert cp.collection_id == collection.id
    assert cp.paper_id == paper.id

    papers = await get_collection_papers(collection.id, str(user.id), db_session)
    assert len(papers) == 1
    assert papers[0].id == paper.id


@pytest.mark.asyncio
async def test_add_paper_duplicate_raises_409(
    db_session: AsyncSession,
    user: User,
    collection: Collection,
    paper: Paper,
):
    await add_paper(collection.id, paper.id, str(user.id), db_session)
    with pytest.raises(IntegrityError):
        await add_paper(collection.id, paper.id, str(user.id), db_session)


@pytest.mark.asyncio
async def test_remove_paper(
    db_session: AsyncSession,
    user: User,
    collection: Collection,
    paper: Paper,
):
    await add_paper(collection.id, paper.id, str(user.id), db_session)
    ok = await remove_paper(collection.id, paper.id, str(user.id), db_session)
    assert ok is True

    papers = await get_collection_papers(collection.id, str(user.id), db_session)
    assert papers == []


@pytest.mark.asyncio
async def test_remove_paper_not_found(
    db_session: AsyncSession,
    user: User,
    collection: Collection,
    paper: Paper,
):
    ok = await remove_paper(collection.id, paper.id, str(user.id), db_session)
    assert ok is False


@pytest.mark.asyncio
async def test_collection_paper_count_in_list(
    db_session: AsyncSession,
    user: User,
    collection: Collection,
    paper: Paper,
):
    await add_paper(collection.id, paper.id, str(user.id), db_session)
    cols = await list_collections(str(user.id), db_session)
    col_data = next(c for c in cols if c["id"] == str(collection.id))
    assert col_data["paper_count"] == 1


# ── Tags ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_tag(db_session: AsyncSession, user: User, paper: Paper):
    pt = await add_tag(str(user.id), paper.id, "nlp", db_session)
    assert pt.tag == "nlp"
    assert pt.user_id == user.id
    assert pt.paper_id == paper.id


@pytest.mark.asyncio
async def test_add_tag_normalises_to_lowercase(
    db_session: AsyncSession, user: User, paper: Paper
):
    pt = await add_tag(str(user.id), paper.id, "NLP", db_session)
    assert pt.tag == "nlp"


@pytest.mark.asyncio
async def test_add_tag_duplicate_raises_integrity_error(
    db_session: AsyncSession, user: User, paper: Paper
):
    await add_tag(str(user.id), paper.id, "nlp", db_session)
    with pytest.raises(IntegrityError):
        await add_tag(str(user.id), paper.id, "nlp", db_session)


@pytest.mark.asyncio
async def test_get_paper_tags(db_session: AsyncSession, user: User, paper: Paper):
    await add_tag(str(user.id), paper.id, "nlp", db_session)
    await add_tag(str(user.id), paper.id, "llm", db_session)
    tags = await get_paper_tags(str(user.id), paper.id, db_session)
    assert sorted(tags) == ["llm", "nlp"]


@pytest.mark.asyncio
async def test_remove_tag(db_session: AsyncSession, user: User, paper: Paper):
    await add_tag(str(user.id), paper.id, "nlp", db_session)
    ok = await remove_tag(str(user.id), paper.id, "nlp", db_session)
    assert ok is True
    tags = await get_paper_tags(str(user.id), paper.id, db_session)
    assert tags == []


@pytest.mark.asyncio
async def test_remove_tag_not_found(
    db_session: AsyncSession, user: User, paper: Paper
):
    ok = await remove_tag(str(user.id), paper.id, "nonexistent", db_session)
    assert ok is False


@pytest.mark.asyncio
async def test_list_by_tag(db_session: AsyncSession, user: User, paper: Paper):
    await add_tag(str(user.id), paper.id, "nlp", db_session)
    papers = await list_by_tag(str(user.id), "nlp", db_session)
    assert len(papers) == 1
    assert papers[0].id == paper.id


@pytest.mark.asyncio
async def test_list_all_tags(db_session: AsyncSession, user: User, paper: Paper):
    await add_tag(str(user.id), paper.id, "nlp", db_session)
    await add_tag(str(user.id), paper.id, "llm", db_session)
    all_tags = await list_all_tags(str(user.id), db_session)
    tag_names = [t["tag"] for t in all_tags]
    assert "nlp" in tag_names
    assert "llm" in tag_names
    for t in all_tags:
        assert t["paper_count"] >= 1
