import pytest

from app.services.plan_service import PLAN_LIMITS, check_quota, get_plan_info


class TestPlanLimits:
    """플랜별 한도 설정 테스트"""

    def test_free_plan_has_limits(self):
        limits = PLAN_LIMITS["free"]
        assert limits["research_count"] == 5
        assert limits["survey_count"] == 3
        assert limits["summary_count"] == 10
        assert limits["healthcheck_count"] == 3

    def test_basic_plan_higher_than_free(self):
        for field in PLAN_LIMITS["free"]:
            assert PLAN_LIMITS["basic"][field] > PLAN_LIMITS["free"][field]

    def test_pro_plan_highest(self):
        for field in PLAN_LIMITS["free"]:
            assert PLAN_LIMITS["pro"][field] >= PLAN_LIMITS["basic"][field]

    def test_all_plans_defined(self):
        assert "free" in PLAN_LIMITS
        assert "basic" in PLAN_LIMITS
        assert "pro" in PLAN_LIMITS


class TestGetPlanInfo:
    """get_plan_info 테스트"""

    @pytest.mark.asyncio
    async def test_free_plan_info(self):
        info = await get_plan_info("free")
        assert info["plan"] == "free"
        assert "limits" in info
        assert info["limits"]["research_count"] == 5

    @pytest.mark.asyncio
    async def test_unknown_plan_falls_back_to_free(self):
        info = await get_plan_info("unknown")
        assert info["limits"] == PLAN_LIMITS["free"]
