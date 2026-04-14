from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.schemas.user import TokenVerifyResponse
from app.services.user_service import get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/verify", response_model=TokenVerifyResponse)
async def verify_token(user_id: str = Depends(get_current_user)):
    """JWT 토큰을 검증하고 사용자 정보를 반환한다.
    사용자가 DB에 없으면 자동 생성한다(첫 로그인)."""
    user = await get_or_create_user(user_id)
    return TokenVerifyResponse(
        user_id=user.id,
        email=user.email,
        plan=user.plan,
    )
