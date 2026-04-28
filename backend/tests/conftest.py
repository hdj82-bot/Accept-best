import json
import os
from pathlib import Path

import pytest
import pytest_asyncio

# 앱 import 전에 NEXTAUTH_SECRET을 설정해야 settings가 올바른 값을 읽는다.
# CI에서 env로 주입되면 그 값을 우선 사용, 없으면 하드코딩 기본값 적용.
os.environ.setdefault("NEXTAUTH_SECRET", "test-secret-key-for-pytest")

from httpx import ASGITransport, AsyncClient  # noqa: E402
from jose import jwt  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models.database import Base, get_db  # noqa: E402


def _to_test_db_url(url: str) -> str:
    """DATABASE_URL을 테스트 DB URL로 변환한다.
    이미 _test 접미사가 붙어 있으면(예: CI 환경) 그대로 사용,
    아니면 마지막 path 컴포넌트(DB 이름)에 _test 접미사를 붙인다."""
    if url.rstrip("/").rsplit("/", 1)[-1].endswith("_test"):
        return url
    base, _, dbname = url.rpartition("/")
    return f"{base}/{dbname}_test"


TEST_DATABASE_URL = _to_test_db_url(settings.DATABASE_URL)

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

# JWT 테스트 상수 — settings에서 읽어 conftest 서명과 app 검증을 동일하게 맞춘다.
NEXTAUTH_SECRET = settings.NEXTAUTH_SECRET
ALGORITHM = "HS256"
TEST_USER_ID = "test-user-001"
TEST_EMAIL = "test@example.com"


@pytest_asyncio.fixture(scope="session")
async def setup_db():
    """테스트 DB에 테이블 생성 및 pgvector 익스텐션 활성화."""
    async with test_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(setup_db) -> AsyncSession:
    """각 테스트마다 트랜잭션 롤백되는 DB 세션."""
    async with TestSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """테스트 HTTP 클라이언트."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def paper_fixtures() -> list[dict]:
    """fixtures/papers.json에서 시드 데이터 10편 로드."""
    fixture_path = Path(__file__).parent / "fixtures" / "papers.json"
    with open(fixture_path, encoding="utf-8") as f:
        return json.load(f)


@pytest_asyncio.fixture
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
