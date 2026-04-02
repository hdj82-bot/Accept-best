from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TTL_SEARCH = 300   # 5분
TTL_USER   = 60    # 1분

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


def make_key(*parts: str) -> str:
    return ":".join(str(p) for p in parts)


def query_hash(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()[:12]


async def get(key: str) -> dict | None:
    try:
        raw = await _get_redis().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("cache get error key=%s: %s", key, exc)
        return None


async def set(key: str, value: Any, ttl: int = TTL_SEARCH) -> None:
    try:
        await _get_redis().set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.warning("cache set error key=%s: %s", key, exc)


async def delete(key: str) -> None:
    try:
        await _get_redis().delete(key)
    except Exception as exc:
        logger.warning("cache delete error key=%s: %s", key, exc)


def search_cache_key(
    query: str,
    year_from: int | None,
    year_to: int | None,
    source: str | None,
) -> str:
    """search:{query_hash}:{year_from}:{year_to}:{source}"""
    return make_key(
        "search",
        query_hash(query),
        str(year_from or ""),
        str(year_to or ""),
        str(source or ""),
    )
