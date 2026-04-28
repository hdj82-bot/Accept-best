import json
from datetime import datetime
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.main import app
from app.models.database import Base, get_db

# 테스트 DB URL — CI는 이미 _test suffix를 붙여 주입하므로 그대로 사용,
# 로컬 .env가 운영 DB명인 경우만 _test를 붙여 분리.
_url = make_url(settings.DATABASE_URL)
if _url.database and not _url.database.endswith("_test"):
    _url = _url.set(database=f"{_url.database}_test")
TEST_DATABASE_URL = _url.render_as_string(hide_password=False)

# JWT 테스트 상수
NEXTAUTH_SECRET = "test-secret-key-for-pytest"
ALGORITHM = "HS256"
TEST_USER_ID = "test-user-001"
TEST_EMAIL = "test@example.com"


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def _engine():
    # NullPool: connection을 풀링하지 않고 매 사용 시점에 새로 만들어 코루틴 간 공유 race 방지.
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(_engine) -> AsyncSession:
    # 매 테스트마다 새 connection + transaction. 종료 시 rollback으로 격리.
    async with _engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest_asyncio.fixture(loop_scope="session")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def paper_fixtures() -> list[dict]:
    """fixtures/papers.json에서 시드 데이터 10편 로드. ISO 문자열 → datetime 변환."""
    fixture_path = Path(__file__).parent / "fixtures" / "papers.json"
    with open(fixture_path, encoding="utf-8") as f:
        data = json.load(f)
    # asyncpg는 DateTime(timezone=True) 컬럼에 datetime 인스턴스를 요구.
    for paper in data:
        published = paper.get("published_at")
        if isinstance(published, str):
            paper["published_at"] = datetime.fromisoformat(published.replace("Z", "+00:00"))
    return data


@pytest_asyncio.fixture(loop_scope="session")
async def seeded_papers(db_session: AsyncSession, paper_fixtures: list[dict]):
    """DB에 논문 10편 시딩."""
    from app.models.paper import Paper

    papers = []
    for data in paper_fixtures:
        paper = Paper(**data)
        db_session.add(paper)
        papers.append(paper)
    await db_session.flush()
    return papers


@pytest.fixture
def auth_token() -> str:
    """테스트용 JWT 토큰을 생성한다."""
    payload = {"sub": TEST_USER_ID, "email": TEST_EMAIL}
    return jwt.encode(payload, NEXTAUTH_SECRET, algorithm=ALGORITHM)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Authorization 헤더를 반환한다."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def invalid_auth_headers() -> dict:
    """잘못된 토큰이 담긴 헤더."""
    return {"Authorization": "Bearer invalid.token.here"}
