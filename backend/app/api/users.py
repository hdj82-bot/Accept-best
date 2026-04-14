from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.schemas.user import UserRead
from app.services.user_service import get_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(user_id: str = Depends(get_current_user)):
    """현재 로그인된 사용자 정보를 조회한다."""
    user = await get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user
