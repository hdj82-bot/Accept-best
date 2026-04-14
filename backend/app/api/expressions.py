from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.expression import ExpressionRequest, ExpressionResponse
from app.services.expression_service import suggest_expressions
from app.services.usage import check_quota, increment_usage

router = APIRouter(prefix="/expressions", tags=["expressions"])


@router.post("", response_model=ExpressionResponse)
async def get_expressions(
    body: ExpressionRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    plan = user.plan if user else "free"

    await check_quota(user_id, "expression_count", plan, db)

    result = await suggest_expressions(body.text, body.context)

    await increment_usage(user_id, "expression_count", db)

    return result
