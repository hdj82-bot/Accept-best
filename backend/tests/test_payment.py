import os
import pytest

os.environ.setdefault("USE_FIXTURES", "true")

from httpx import AsyncClient


@pytest.mark.asyncio
async def test_prepare_payment(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/payment/prepare",
        json={"plan": "basic", "months": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "merchant_uid" in data
    assert data["amount"] == 9900
    assert data["plan"] == "basic"


@pytest.mark.asyncio
async def test_complete_payment_upgrades_plan(client: AsyncClient, auth_headers: dict):
    # 1. prepare
    prep = await client.post(
        "/payment/prepare",
        json={"plan": "basic", "months": 1},
        headers=auth_headers,
    )
    merchant_uid = prep.json()["merchant_uid"]

    # 2. complete (USE_FIXTURES=true → mock paid)
    resp = await client.post(
        "/payment/complete",
        json={"imp_uid": "imp_test_123", "merchant_uid": merchant_uid},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "paid"
    assert data["plan"] == "basic"
    assert data["paid_at"] is not None

    # 3. 플랜 업그레이드 확인
    me = await client.get("/api/users/me", headers=auth_headers)
    if me.status_code == 200:
        assert me.json().get("plan") == "basic"


@pytest.mark.asyncio
async def test_payment_history(client: AsyncClient, auth_headers: dict):
    # 결제 하나 생성
    prep = await client.post(
        "/payment/prepare",
        json={"plan": "pro", "months": 1},
        headers=auth_headers,
    )
    merchant_uid = prep.json()["merchant_uid"]
    await client.post(
        "/payment/complete",
        json={"imp_uid": "imp_test_456", "merchant_uid": merchant_uid},
        headers=auth_headers,
    )

    resp = await client.get("/payment/history", headers=auth_headers)
    assert resp.status_code == 200
    history = resp.json()
    assert isinstance(history, list)
    assert len(history) >= 1
    assert history[0]["plan"] in ("basic", "pro")


@pytest.mark.asyncio
async def test_prepare_invalid_plan(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/payment/prepare",
        json={"plan": "free", "months": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_complete_invalid_merchant_uid(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/payment/complete",
        json={"imp_uid": "imp_fake", "merchant_uid": "nonexistent_uid"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
