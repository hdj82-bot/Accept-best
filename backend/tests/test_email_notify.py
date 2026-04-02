"""
Tests for email rendering and notification tasks (fixture mode).
"""

from __future__ import annotations

import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("USE_FIXTURES", "true")

from app.models.users import User
from app.services.email_service import (
    render_payment_complete,
    render_plan_expiry_warning,
    send_email,
)


# ── render tests (pure functions — no DB needed) ──────────────────────────────


def test_render_payment_complete_contains_plan():
    html = render_payment_complete("test@example.com", "basic", 9900)
    assert "Basic" in html
    assert "9,900" in html


def test_render_plan_expiry_warning_contains_days():
    html = render_plan_expiry_warning("test@example.com", "pro", 3)
    assert "3" in html
    assert "pro" in html


def test_send_email_fixture_mode_no_exception():
    """USE_FIXTURES=true 상태에서 send_email 호출 시 예외 없이 통과."""
    send_email(
        to="test@example.com",
        subject="테스트 메일",
        html_body="<p>테스트</p>",
    )


# ── task test ─────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def pro_user_for_notify(db_session: AsyncSession) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"notify_{uuid.uuid4().hex[:6]}@example.com",
        provider="google",
        plan="pro",
    )
    db_session.add(u)
    await db_session.flush()
    return u


@pytest.mark.asyncio
async def test_send_plan_expiry_warning_fixture_mode(pro_user_for_notify: User):
    """send_plan_expiry_warning 태스크가 dict를 반환하는지 확인."""
    from app.tasks.notify import send_plan_expiry_warning

    result = send_plan_expiry_warning.apply(args=[str(pro_user_for_notify.id)]).get()
    assert isinstance(result, dict)
    assert result.get("sent") is True or result.get("skipped") is True
