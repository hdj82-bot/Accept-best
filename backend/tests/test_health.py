"""
Tests for the /health endpoint.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient):
    """GET /health should always return HTTP 200."""
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_has_status_field(client: AsyncClient):
    """GET /health response must contain a 'status' field."""
    response = await client.get("/health")
    body = response.json()
    assert "status" in body
    assert body["status"] in ("ok", "degraded")


@pytest.mark.asyncio
async def test_health_content_type_is_json(client: AsyncClient):
    """GET /health response must be JSON."""
    response = await client.get("/health")
    assert "application/json" in response.headers.get("content-type", "")
