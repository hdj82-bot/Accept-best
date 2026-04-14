from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.models.paper import Paper
from app.models.user import User
from app.schemas.diagnosis import DiagnosisResult
from app.services.diagnosis_service import diagnose_paper
from app.services.usage import check_quota, increment_usage

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


@router.post("/{paper_id}", response_model=DiagnosisResult)
async def run_diagnosis(
    paper_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.abstract:
        raise HTTPException(status_code=400, detail="Paper has no abstract")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    plan = user.plan if user else "free"

    await check_quota(user_id, "diagnosis_count", plan, db)

    diagnosis = await diagnose_paper(paper.id, paper.title, paper.abstract)

    await increment_usage(user_id, "diagnosis_count", db)

    return diagnosis
