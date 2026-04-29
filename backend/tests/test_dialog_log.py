"""user_dialog_answers 저장/조회 + /api/diagnosis/answer 라우트 테스트."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.services.dialog_log import (
    SERVICE_NAMES,
    list_dialog_answers,
    log_dialog_answer,
)


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, settings.NEXTAUTH_SECRET, algorithm="HS256")


@pytest_asyncio.fixture(loop_scope="session")
async def _user(db_session: AsyncSession) -> User:
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()
    return user


# ──────────────────────────────────────────────
# services.dialog_log
# ──────────────────────────────────────────────


def test_service_names_set_matches_policy():
    """대화 정책에서 명시한 4개 서비스가 SERVICE_NAMES 와 일치해야 한다."""
    assert SERVICE_NAMES == frozenset(
        {"summary", "survey", "diagnosis", "note_to_draft"}
    )


@pytest.mark.asyncio
async def test_log_dialog_answer_persists(db_session: AsyncSession, _user: User):
    entry = await log_dialog_answer(
        user_id=_user.id,
        service_name="diagnosis",
        context_id=str(uuid.uuid4()),
        question="이 부분에서 의도하신 것이 무엇인가요?",
        answer="A 와 B 를 연결하는 가설을 검증하려 했습니다.",
        db=db_session,
    )
    assert entry.id
    assert entry.user_id == _user.id
    assert entry.service_name == "diagnosis"
    assert entry.created_at is not None


@pytest.mark.asyncio
async def test_log_dialog_answer_rejects_unknown_service(
    db_session: AsyncSession, _user: User
):
    with pytest.raises(ValueError, match="unknown service_name"):
        await log_dialog_answer(
            user_id=_user.id,
            service_name="nope",
            context_id=str(uuid.uuid4()),
            question="q",
            answer="a",
            db=db_session,
        )


@pytest.mark.asyncio
async def test_list_dialog_answers_filters_by_service_and_context(
    db_session: AsyncSession, _user: User
):
    ctx_a = str(uuid.uuid4())
    ctx_b = str(uuid.uuid4())
    await log_dialog_answer(
        user_id=_user.id, service_name="diagnosis", context_id=ctx_a,
        question="q1", answer="a1", db=db_session,
    )
    await log_dialog_answer(
        user_id=_user.id, service_name="diagnosis", context_id=ctx_b,
        question="q2", answer="a2", db=db_session,
    )
    await log_dialog_answer(
        user_id=_user.id, service_name="summary", context_id=ctx_a,
        question="q3", answer="a3", db=db_session,
    )

    rows, total = await list_dialog_answers(user_id=_user.id, db=db_session)
    assert total == 3

    rows, total = await list_dialog_answers(
        user_id=_user.id, db=db_session, service_name="diagnosis",
    )
    assert total == 2
    assert {r.service_name for r in rows} == {"diagnosis"}

    rows, total = await list_dialog_answers(
        user_id=_user.id, db=db_session, context_id=ctx_a,
    )
    assert total == 2
    assert {r.context_id for r in rows} == {ctx_a}

    rows, total = await list_dialog_answers(
        user_id=_user.id, db=db_session,
        service_name="diagnosis", context_id=ctx_b,
    )
    assert total == 1
    assert rows[0].question == "q2"


@pytest.mark.asyncio
async def test_list_dialog_answers_isolates_users(db_session: AsyncSession):
    a_id, b_id = str(uuid.uuid4()), str(uuid.uuid4())
    db_session.add_all([
        User(id=a_id, email=f"{a_id[:8]}@t.com", plan="free"),
        User(id=b_id, email=f"{b_id[:8]}@t.com", plan="free"),
    ])
    await db_session.flush()

    await log_dialog_answer(
        user_id=a_id, service_name="diagnosis", context_id=str(uuid.uuid4()),
        question="qa", answer="aa", db=db_session,
    )
    await log_dialog_answer(
        user_id=b_id, service_name="diagnosis", context_id=str(uuid.uuid4()),
        question="qb", answer="ab", db=db_session,
    )

    _, total_a = await list_dialog_answers(user_id=a_id, db=db_session)
    _, total_b = await list_dialog_answers(user_id=b_id, db=db_session)
    assert total_a == 1
    assert total_b == 1


# ──────────────────────────────────────────────
# POST /api/diagnosis/answer
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_diagnosis_answer_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/diagnosis/answer",
        json={"context_id": str(uuid.uuid4()), "question": "q", "answer": "a"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_submit_diagnosis_answer_persists(
    client: AsyncClient, db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    payload = {
        "context_id": str(uuid.uuid4()),
        "question": "서론과 결론의 연결을 어떻게 의도하셨나요?",
        "answer": "X → Y 로 이어지도록 §3.2 에서 다리 논증을 두었습니다.",
    }
    token = make_token(user_id)
    resp = await client.post(
        "/api/diagnosis/answer",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["service_name"] == "diagnosis"
    assert body["context_id"] == payload["context_id"]
    assert body["user_id"] == user_id
    assert body["question"] == payload["question"]
    assert body["answer"] == payload["answer"]
    assert body["id"]


@pytest.mark.asyncio
async def test_submit_diagnosis_answer_validates_payload(
    client: AsyncClient, auth_headers: dict,
):
    # 빈 question
    resp = await client.post(
        "/api/diagnosis/answer",
        json={"context_id": str(uuid.uuid4()), "question": "", "answer": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
