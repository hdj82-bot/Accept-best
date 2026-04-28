import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.main import app
from app.models.database import get_db
from app.models.user import User


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, settings.NEXTAUTH_SECRET, algorithm="HS256")


# ──────────────────────────────────────────────
# GET /plans (인증 불필요)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_plans_returns_three(client: AsyncClient):
    resp = await client.get("/api/plans")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    names = [p["name"] for p in data]
    assert names == ["free", "basic", "pro"]


@pytest.mark.asyncio
async def test_list_plans_free_limits(client: AsyncClient):
    resp = await client.get("/api/plans")
    free = resp.json()[0]
    assert free["price_krw"] == 0
    assert free["limits"]["research_count"] == 5
    assert free["limits"]["survey_count"] == 3


@pytest.mark.asyncio
async def test_list_plans_pro_unlimited(client: AsyncClient):
    resp = await client.get("/api/plans")
    pro = resp.json()[2]
    assert pro["limits"]["research_count"] == -1


# ──────────────────────────────────────────────
# GET /plans/usage (인증 필요)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_usage_requires_auth(client: AsyncClient):
    resp = await client.get("/api/plans/usage")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_usage_returns_zero_for_new_user(
    client: AsyncClient, db_session: AsyncSession
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="free")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    resp = await client.get(
        "/api/plans/usage", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "free"
    assert data["usage"]["research_count"] == 0
    assert data["usage"]["survey_count"] == 0
    assert data["limits"]["research_count"] == 5


@pytest.mark.asyncio
async def test_usage_reflects_user_plan(
    client: AsyncClient, db_session: AsyncSession
):
    user_id = str(uuid.uuid4())
    user = User(id=user_id, email=f"{user_id[:8]}@test.com", plan="basic")
    db_session.add(user)
    await db_session.flush()

    token = make_token(user_id)
    resp = await client.get(
        "/api/plans/usage", headers={"Authorization": f"Bearer {token}"}
    )
    data = resp.json()
    assert data["plan"] == "basic"
    assert data["limits"]["research_count"] == 30
