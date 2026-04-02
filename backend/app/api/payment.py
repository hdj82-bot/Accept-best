from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.payment import Payment
from app.services.payment_service import (
    PaymentVerificationError,
    create_payment_record,
    handle_webhook,
    verify_and_complete,
    verify_webhook_signature,
)

router = APIRouter(prefix="/payment", tags=["payment"])


class PrepareRequest(BaseModel):
    plan: str = Field(..., pattern="^(basic|pro)$")
    months: int = Field(default=1, ge=1, le=12)


class CompleteRequest(BaseModel):
    imp_uid: str
    merchant_uid: str


@router.post("/prepare")
async def prepare_payment(
    body: PrepareRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_payment_record(user_id, body.plan, body.months, db)


@router.post("/complete")
async def complete_payment(
    body: CompleteRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        payment = await verify_and_complete(body.imp_uid, body.merchant_uid, db)
    except PaymentVerificationError as e:
        raise HTTPException(status_code=e.status, detail=e.message)

    return {
        "status": payment.status,
        "plan": payment.plan,
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }


@router.post("/webhook", include_in_schema=False)
async def portone_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    signature = request.headers.get("X-IamportSignature", "")

    if not verify_webhook_signature(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = await request.json()
    try:
        result = await handle_webhook(data, db)
    except PaymentVerificationError as e:
        raise HTTPException(status_code=e.status, detail=e.message)

    return result


@router.get("/history")
async def payment_history(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "plan": p.plan,
            "months": p.months,
            "amount": p.amount,
            "status": p.status,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "created_at": p.created_at.isoformat(),
        }
        for p in payments
    ]
