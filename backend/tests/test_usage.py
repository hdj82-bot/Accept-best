import uuid
from datetime import datetime
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import QuotaExceededError
from app.models.monthly_usage import MonthlyUsage
from app.models.user import User
from app.services.usage import (
    ALLOWED_FIELDS,
    PLAN_LIMITS,
    check_quota,
    get_usage,
    increment_usage,
)


# ──────────────────────────────────────────────
# get_usage
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_usage_returns_none_when_no_record(db_session: AsyncSession):
    result = await get_usage(str(uuid.uuid4()), db_session)
    assert result is None


@pytest.mark.asyncio
async def test_get_usage_returns_current_month(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    year_month = datetime.now().strftime("%Y-%m")
    row = MonthlyUsage(
        user_id=user_id,
        year_month=year_month,
        research_count=3,
        survey_count=1,
        summary_count=0,
        healthcheck_count=0,
    )
    db_session.add(row)
    await db_session.flush()

    usage = await get_usage(user_id, db_session)
    assert usage is not None
    assert usage.research_count == 3
    assert usage.survey_count == 1


@pytest.mark.asyncio
async def test_get_usage_ignores_other_months(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    row = MonthlyUsage(
        user_id=user_id,
        year_month="2020-01",
        research_count=99,
        survey_count=0,
        summary_count=0,
        healthcheck_count=0,
    )
    db_session.add(row)
    await db_session.flush()

    usage = await get_usage(user_id, db_session)
    assert usage is None


# ──────────────────────────────────────────────
# check_quota
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_check_quota_passes_when_under_limit(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    # 레코드 없음 → 사용량 0 → free 한도(5) 이내
    await check_quota(user_id, "research_count", "free", db_session)


@pytest.mark.asyncio
async def test_check_quota_raises_when_at_limit(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    year_month = datetime.now().strftime("%Y-%m")
    row = MonthlyUsage(
        user_id=user_id,
        year_month=year_month,
        research_count=5,  # free 한도 = 5
        survey_count=0,
        summary_count=0,
        healthcheck_count=0,
    )
    db_session.add(row)
    await db_session.flush()

    with pytest.raises(QuotaExceededError):
        await check_quota(user_id, "research_count", "free", db_session)


@pytest.mark.asyncio
async def test_check_quota_pro_never_raises(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    year_month = datetime.now().strftime("%Y-%m")
    row = MonthlyUsage(
        user_id=user_id,
        year_month=year_month,
        research_count=9999,
        survey_count=0,
        summary_count=0,
        healthcheck_count=0,
    )
    db_session.add(row)
    await db_session.flush()

    # pro는 무제한 → 예외 없음
    await check_quota(user_id, "research_count", "pro", db_session)


@pytest.mark.asyncio
async def test_check_quota_invalid_field(db_session: AsyncSession):
    with pytest.raises(ValueError, match="Invalid usage field"):
        await check_quota(str(uuid.uuid4()), "invalid_field", "free", db_session)


# ──────────────────────────────────────────────
# increment_usage
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_increment_creates_row(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    await increment_usage(user_id, "research_count", db_session)

    usage = await get_usage(user_id, db_session)
    assert usage is not None
    assert usage.research_count == 1


@pytest.mark.asyncio
async def test_increment_updates_existing(db_session: AsyncSession):
    user_id = str(uuid.uuid4())
    await increment_usage(user_id, "summary_count", db_session)
    await increment_usage(user_id, "summary_count", db_session)

    usage = await get_usage(user_id, db_session)
    assert usage.summary_count == 2


@pytest.mark.asyncio
async def test_increment_invalid_field(db_session: AsyncSession):
    with pytest.raises(ValueError, match="Invalid usage field"):
        await increment_usage(str(uuid.uuid4()), "bad_field", db_session)


# ──────────────────────────────────────────────
# PLAN_LIMITS 정합성
# ──────────────────────────────────────────────

def test_plan_limits_has_all_plans():
    assert set(PLAN_LIMITS.keys()) == {"free", "basic", "pro"}


def test_plan_limits_fields_match_allowed():
    for plan, limits in PLAN_LIMITS.items():
        assert set(limits.keys()) == ALLOWED_FIELDS, f"{plan} fields mismatch"


def test_free_limits_are_positive():
    for field, value in PLAN_LIMITS["free"].items():
        assert value > 0, f"free.{field} should be positive"


def test_pro_limits_are_unlimited():
    for field, value in PLAN_LIMITS["pro"].items():
        assert value == -1, f"pro.{field} should be -1 (unlimited)"
