import pytest
from jose import jwt

from app.core.auth import get_current_user, ALGORITHM, PLAN_ORDER

NEXTAUTH_SECRET = "test-secret-key-for-pytest"
TEST_USER_ID = "test-user-001"


class TestGetCurrentUser:
    """get_current_user 의존성 테스트"""

    @pytest.mark.asyncio
    async def test_valid_token(self, monkeypatch):
        monkeypatch.setattr("app.core.auth.settings.NEXTAUTH_SECRET", NEXTAUTH_SECRET)
        token = jwt.encode({"sub": TEST_USER_ID}, NEXTAUTH_SECRET, algorithm=ALGORITHM)

        user_id = await get_current_user(token=token)
        assert user_id == TEST_USER_ID

    @pytest.mark.asyncio
    async def test_missing_token(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token=None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token(self, monkeypatch):
        monkeypatch.setattr("app.core.auth.settings.NEXTAUTH_SECRET", NEXTAUTH_SECRET)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token="invalid.token.value")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_token_without_sub(self, monkeypatch):
        monkeypatch.setattr("app.core.auth.settings.NEXTAUTH_SECRET", NEXTAUTH_SECRET)
        token = jwt.encode({"email": "no-sub@test.com"}, NEXTAUTH_SECRET, algorithm=ALGORITHM)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token=token)
        assert exc_info.value.status_code == 401


class TestPlanOrder:
    """플랜 등급 순서 테스트"""

    def test_free_is_lowest(self):
        assert PLAN_ORDER["free"] < PLAN_ORDER["basic"]
        assert PLAN_ORDER["free"] < PLAN_ORDER["pro"]

    def test_basic_is_middle(self):
        assert PLAN_ORDER["basic"] > PLAN_ORDER["free"]
        assert PLAN_ORDER["basic"] < PLAN_ORDER["pro"]

    def test_pro_is_highest(self):
        assert PLAN_ORDER["pro"] > PLAN_ORDER["basic"]
        assert PLAN_ORDER["pro"] > PLAN_ORDER["free"]
