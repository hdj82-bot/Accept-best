import pytest
from fastapi import APIRouter

from app.core.exceptions import (
    AppError,
    ExternalAPIError,
    QuotaExceededError,
    RateLimitError,
)
from app.main import app

# 테스트용 라우터: 각 에러를 발생시키는 엔드포인트
_test_router = APIRouter()


@_test_router.get("/test-error/app")
async def raise_app_error():
    raise AppError("TEST_ERROR", "test error message", 500)


@_test_router.get("/test-error/rate-limit")
async def raise_rate_limit():
    raise RateLimitError("arxiv")


@_test_router.get("/test-error/quota")
async def raise_quota():
    raise QuotaExceededError("survey")


@_test_router.get("/test-error/external")
async def raise_external():
    raise ExternalAPIError("semantic_scholar", "timeout")


app.include_router(_test_router)


@pytest.mark.asyncio
async def test_app_error_json(client):
    resp = await client.get("/test-error/app")
    assert resp.status_code == 500
    body = resp.json()
    assert body == {"error": "TEST_ERROR", "message": "test error message"}


@pytest.mark.asyncio
async def test_rate_limit_error(client):
    resp = await client.get("/test-error/rate-limit")
    assert resp.status_code == 429
    body = resp.json()
    assert body["error"] == "RATE_LIMIT"


@pytest.mark.asyncio
async def test_quota_exceeded_error(client):
    resp = await client.get("/test-error/quota")
    assert resp.status_code == 402
    body = resp.json()
    assert body["error"] == "QUOTA_EXCEEDED"


@pytest.mark.asyncio
async def test_external_api_error(client):
    resp = await client.get("/test-error/external")
    assert resp.status_code == 502
    body = resp.json()
    assert body["error"] == "EXTERNAL_API"
    assert "semantic_scholar" in body["message"]
