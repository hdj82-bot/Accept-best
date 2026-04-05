from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ── TTL constants ────────────────────────────────────────────────────────────
TTL_SEARCH = 300     # 5분 — 검색 결과
TTL_USER   = 3600    # 1시간 — 사용자 플랜 정보
TTL_META   = 600     # 10분 — 공개 통계

_redis: aioredis.Redis | None = None


def _cache_redis_url() -> str:
    """캐싱용 Redis URL — DB 2번 사용 (Celery broker = DB 0)."""
    settings = get_settings()
    base = settings.redis_url.rstrip("/")
    # redis://host:6379/0 → redis://host:6379/2
    if base.endswith("/0"):
        return base[:-1] + "2"
    return base + "/2"


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            _cache_redis_url(),
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


def make_key(*parts: str) -> str:
    return ":".join(str(p) for p in parts)


def query_hash(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()[:12]


# ── Core operations ──────────────────────────────────────────────────────────


async def get(key: str) -> dict | list | None:
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


async def delete_pattern(pattern: str) -> int:
    """Delete all keys matching a glob pattern. Returns count deleted."""
    try:
        r = _get_redis()
        keys = []
        async for key in r.scan_iter(match=pattern, count=100):
            keys.append(key)
        if keys:
            return await r.delete(*keys)
        return 0
    except Exception as exc:
        logger.warning("cache delete_pattern error pattern=%s: %s", pattern, exc)
        return 0


# ── Key builders ─────────────────────────────────────────────────────────────


def search_cache_key(
    query: str,
    year_from: int | None,
    year_to: int | None,
    source: str | None,
) -> str:
    return make_key(
        "search",
        query_hash(query),
        str(year_from or ""),
        str(year_to or ""),
        str(source or ""),
    )


def user_plan_key(user_id: str) -> str:
    return make_key("user", user_id, "plan")


def meta_stats_key() -> str:
    return "meta:stats"


# ── Cache invalidation helpers ───────────────────────────────────────────────


async def invalidate_user(user_id: str) -> None:
    """Invalidate all caches for a specific user (plan change, upgrade, etc.)."""
    await delete(user_plan_key(user_id))


async def invalidate_search() -> None:
    """Invalidate all search caches (after new papers are collected)."""
    await delete_pattern("search:*")
    await delete_pattern("hybrid:*")


async def invalidate_meta() -> None:
    """Invalidate meta stats (after user/paper count changes)."""
    await delete(meta_stats_key())
