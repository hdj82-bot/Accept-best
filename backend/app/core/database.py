from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import get_settings

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
    pool_recycle=1800,       # 30분마다 커넥션 재활용
    connect_args={
        "server_settings": {"statement_timeout": "30000"},  # 30초 쿼리 타임아웃
    } if "postgresql" in _settings.database_url else {},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
