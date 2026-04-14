"""인증/인가 모듈 테스트 — get_current_user, plan_required."""
import uuid

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI, HTTPException
from httpx import ASIOTransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, plan_required
from app.core.config import settings
from app.core.exceptions import QuotaExceededError
from app.models.user import User


def _make_token(payload: dict) -> str:
    return jwt.encode(payload, settings.NEXTAUTH_SECRET, algorithm="HS256")


# ──────────────────────────────────────────────
# get_current_user — 단위 테스트
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_current_user_valid_token():
    token = _make_token({"sub": "user-123"})
    user_id = await get_current_user(token)
    assert user_id == "user-123"


@pytest.mark.asyncio
async def test_get_current_user_no_token():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(None)
    assert exc_info.value.status_code == 401
    assert "Not authenticated" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_empty_string():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_invalid_jwt():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user("not-a-valid-jwt")
    assert exc_info.value.status_code == 401
    assert "Invalid token" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_wrong_secret():
    token = jwt.encode({"sub": "user-1"}, "wrong-secret", algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_missing_sub():
    token = _make_token({"role": "admin"})  # no "sub"
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token)
    assert exc_info.value.status_code == 401
    assert "Invalid token" in exc_info.value.detail


# ──────────────────────────────────────────────
# plan_required — 통합 테스트 (미니 앱)
# ──────────────────────────────────────────────


@pytest_asyncio.fixture
async def plan_app(db_session: AsyncSession):
    """plan_required 데코레이터가 적용된 미니 FastAPI 앱."""
    from app.models.database import get_db

    mini = FastAPI()

    async def override_get_db():
        yield db_session

    mini.dependency_overrides[get_db] = override_get_db

    @mini.get("/basic-only")
    @plan_required("basic")
    async def basic_endpoint(user_id: str = Depends(get_current_user), db=Depends(get_db)):
        return {"ok": True, "user_id": user_id}

    @mini.get("/pro-only")
    @plan_required("pro")
    async def pro_endpoint(user_id: str = Depends(get_current_user), db=Depends(get_db)):
        return {"ok": True}

    transport = ASIOTransport(app=mini)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    mini.dependency_overrides.clear()


@pytest_asyncio.fixture
async def free_user(db_session: AsyncSession) -> tuple[str, dict]:
    uid = str(uuid.uuid4())
    db_session.add(User(id=uid, email=f"{uid[:8]}@test.com", plan="free"))
    await db_session.flush()
    token = _make_token({"sub": uid})
    return uid, {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def basic_user(db_session: AsyncSession) -> tuple[str, dict]:
    uid = str(uuid.uuid4())
    db_session.add(User(id=uid, email=f"{uid[:8]}@test.com", plan="basic"))
    await db_session.flush()
    token = _make_token({"sub": uid})
    return uid, {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def pro_user(db_session: AsyncSession) -> tuple[str, dict]:
    uid = str(uuid.uuid4())
    db_session.add(User(id=uid, email=f"{uid[:8]}@test.com", plan="pro"))
    await db_session.flush()
    token = _make_token({"sub": uid})
    return uid, {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_plan_required_blocks_free_from_basic(plan_app, free_user):
    _, headers = free_user
    resp = await plan_app.get("/basic-only", headers=headers)
    # QuotaExceededError → 500 (no handler on mini app) 또는 402
    assert resp.status_code in (402, 500)


@pytest.mark.asyncio
async def test_plan_required_allows_basic_for_basic(plan_app, basic_user):
    _, headers = basic_user
    resp = await plan_app.get("/basic-only", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


@pytest.mark.asyncio
async def test_plan_required_allows_pro_for_basic(plan_app, pro_user):
    _, headers = pro_user
    resp = await plan_app.get("/basic-only", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_plan_required_blocks_basic_from_pro(plan_app, basic_user):
    _, headers = basic_user
    resp = await plan_app.get("/pro-only", headers=headers)
    assert resp.status_code in (402, 500)


@pytest.mark.asyncio
async def test_plan_required_allows_pro_for_pro(plan_app, pro_user):
    _, headers = pro_user
    resp = await plan_app.get("/pro-only", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_plan_required_rejects_nonexistent_user(plan_app):
    """DB에 없는 유저 → QuotaExceededError."""
    token = _make_token({"sub": str(uuid.uuid4())})
    resp = await plan_app.get("/basic-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (402, 500)
