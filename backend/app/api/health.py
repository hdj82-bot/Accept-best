from fastapi import APIRouter
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import redis.asyncio as aioredis

from app.core.config import get_settings

router = APIRouter()


@router.get("/health", tags=["meta"])
async def health() -> dict:
    settings = get_settings()
    db_status = "fail"
    redis_status = "fail"

    # DB ping
    try:
        engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await engine.dispose()
        db_status = "ok"
    except Exception:
        pass

    # Redis ping
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        redis_status = "ok"
    except Exception:
        pass

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"
    return {"status": overall, "db": db_status, "redis": redis_status}
