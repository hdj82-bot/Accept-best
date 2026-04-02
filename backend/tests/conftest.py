import pytest
from jose import jwt

NEXTAUTH_SECRET = "test-secret-key-for-pytest"
ALGORITHM = "HS256"
TEST_USER_ID = "test-user-001"
TEST_EMAIL = "test@example.com"


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
