"""
Tests for payment endpoints and payment_service logic.

Tests run with USE_FIXTURES=true for fixture-mode paths AND mock the PortOne
API to test the real verification path without calling external services.
"""

import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("USE_FIXTURES", "true")

from app.models.payment import Payment
from app.models.users import User
from app.services.payment_service import (
    PaymentVerificationError,
    create_payment_record,
    verify_and_complete,
    verify_webhook_signature,
)


# ── HTTP endpoint tests (fixture mode) ──────────────────────────────────────


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


# ── Service layer tests (actual logic, not fixture mode) ────────────────────


@pytest.mark.asyncio
async def test_create_payment_record_calculates_amount(db_session: AsyncSession, test_user: User):
    """create_payment_record computes amount = plan_price * months."""
    record = await create_payment_record(
        user_id=str(test_user.id),
        plan="pro",
        months=3,
        db=db_session,
    )
    assert record["amount"] == 29900 * 3
    assert record["plan"] == "pro"
    assert record["merchant_uid"].startswith("academi_")


@pytest.mark.asyncio
async def test_verify_and_complete_portone_api_path(db_session: AsyncSession, test_user: User):
    """Test the real PortOne verification path with mocked HTTP calls."""
    # Create a pending payment
    record = await create_payment_record(
        user_id=str(test_user.id),
        plan="basic",
        months=1,
        db=db_session,
    )
    merchant_uid = record["merchant_uid"]

    # Mock settings to disable fixture mode
    mock_settings = MagicMock()
    mock_settings.use_fixtures = False
    mock_settings.portone_api_key = "test-key"
    mock_settings.portone_api_secret = "test-secret"

    # Mock PortOne token response
    token_resp = MagicMock()
    token_resp.status_code = 200
    token_resp.raise_for_status = MagicMock()
    token_resp.json.return_value = {"response": {"access_token": "portone-token-123"}}

    # Mock PortOne payment verification response
    verify_resp = MagicMock()
    verify_resp.status_code = 200
    verify_resp.raise_for_status = MagicMock()
    verify_resp.json.return_value = {
        "response": {
            "status": "paid",
            "amount": 9900,
        }
    }

    mock_http_client = AsyncMock()
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)
    mock_http_client.post.return_value = token_resp
    mock_http_client.get.return_value = verify_resp

    with patch("app.services.payment_service.get_settings", return_value=mock_settings), \
         patch("app.services.payment_service.httpx.AsyncClient", return_value=mock_http_client), \
         patch("app.services.payment_service.upgrade_plan", new_callable=AsyncMock) as mock_upgrade:
        payment = await verify_and_complete("imp_real_001", merchant_uid, db_session)

    assert payment.status == "paid"
    assert payment.paid_at is not None
    mock_upgrade.assert_called_once_with(str(test_user.id), "basic", db_session, 1)


@pytest.mark.asyncio
async def test_verify_and_complete_amount_mismatch(db_session: AsyncSession, test_user: User):
    """Payment fails when PortOne amount doesn't match expected amount."""
    record = await create_payment_record(
        user_id=str(test_user.id),
        plan="basic",
        months=1,
        db=db_session,
    )
    merchant_uid = record["merchant_uid"]

    mock_settings = MagicMock()
    mock_settings.use_fixtures = False
    mock_settings.portone_api_key = "test-key"
    mock_settings.portone_api_secret = "test-secret"

    token_resp = MagicMock()
    token_resp.raise_for_status = MagicMock()
    token_resp.json.return_value = {"response": {"access_token": "tok"}}

    # Amount mismatch: expected 9900 but PortOne says 5000
    verify_resp = MagicMock()
    verify_resp.raise_for_status = MagicMock()
    verify_resp.json.return_value = {
        "response": {"status": "paid", "amount": 5000}
    }

    mock_http_client = AsyncMock()
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)
    mock_http_client.post.return_value = token_resp
    mock_http_client.get.return_value = verify_resp

    with patch("app.services.payment_service.get_settings", return_value=mock_settings), \
         patch("app.services.payment_service.httpx.AsyncClient", return_value=mock_http_client):
        with pytest.raises(PaymentVerificationError, match="금액 불일치"):
            await verify_and_complete("imp_amt_err", merchant_uid, db_session)


@pytest.mark.asyncio
async def test_verify_and_complete_portone_status_not_paid(db_session: AsyncSession, test_user: User):
    """Payment fails when PortOne status is not 'paid'."""
    record = await create_payment_record(
        user_id=str(test_user.id),
        plan="basic",
        months=1,
        db=db_session,
    )
    merchant_uid = record["merchant_uid"]

    mock_settings = MagicMock()
    mock_settings.use_fixtures = False
    mock_settings.portone_api_key = "test-key"
    mock_settings.portone_api_secret = "test-secret"

    token_resp = MagicMock()
    token_resp.raise_for_status = MagicMock()
    token_resp.json.return_value = {"response": {"access_token": "tok"}}

    verify_resp = MagicMock()
    verify_resp.raise_for_status = MagicMock()
    verify_resp.json.return_value = {
        "response": {"status": "cancelled", "amount": 9900}
    }

    mock_http_client = AsyncMock()
    mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_client.__aexit__ = AsyncMock(return_value=False)
    mock_http_client.post.return_value = token_resp
    mock_http_client.get.return_value = verify_resp

    with patch("app.services.payment_service.get_settings", return_value=mock_settings), \
         patch("app.services.payment_service.httpx.AsyncClient", return_value=mock_http_client):
        with pytest.raises(PaymentVerificationError, match="상태 오류"):
            await verify_and_complete("imp_cancel", merchant_uid, db_session)


@pytest.mark.asyncio
async def test_verify_nonexistent_payment(db_session: AsyncSession):
    """verify_and_complete raises when merchant_uid doesn't exist."""
    with pytest.raises(PaymentVerificationError, match="찾을 수 없"):
        await verify_and_complete("imp_x", "nonexistent_uid", db_session)


def test_webhook_signature_fixture_mode():
    """In fixture mode, webhook signature is always valid."""
    assert verify_webhook_signature(b"any body", "any-sig") is True


def test_webhook_signature_invalid():
    """With a real secret, wrong signature returns False."""
    mock_settings = MagicMock()
    mock_settings.use_fixtures = False
    mock_settings.portone_webhook_secret = "real-secret"

    with patch("app.services.payment_service.get_settings", return_value=mock_settings):
        assert verify_webhook_signature(b"body", "wrong-sig") is False


@pytest.mark.asyncio
async def test_prepare_multi_month_amount(client: AsyncClient, auth_headers: dict):
    """Prepare with months=6 returns amount = plan_price * 6."""
    resp = await client.post(
        "/payment/prepare",
        json={"plan": "basic", "months": 6},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 9900 * 6
