from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.schemas.translation import TranslationRequest, TranslationResponse
from app.services.translation_service import translate_text
from app.services.usage import check_quota, increment_usage

router = APIRouter(prefix="/translate", tags=["translation"])


@router.post("", response_model=TranslationResponse)
async def run_translation(
    body: TranslationRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    plan = user.plan if user else "free"

    await check_quota(user_id, "translation_count", plan, db)

    result = await translate_text(body.text, body.source_lang, body.target_lang)

    await increment_usage(user_id, "translation_count", db)

    return result
