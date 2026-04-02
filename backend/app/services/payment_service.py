from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppError
from app.models.payment import Payment
from app.services.billing_service import get_plan_price, upgrade_plan

USE_FIXTURES = os.getenv("USE_FIXTURES", "false").lower() == "true"

PORTONE_API_BASE = "https://api.iamport.kr"


class PaymentVerificationError(AppError):
    def __init__(self, message: str = "결제 검증 실패"):
        super().__init__(code="PAYMENT_VERIFICATION_ERROR", message=message, status=400)


async def _get_portone_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PORTONE_API_BASE}/users/getToken",
            json={
                "imp_key": settings.PORTONE_API_KEY,
                "imp_secret": settings.PORTONE_API_SECRET,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["response"]["access_token"]


async def create_payment_record(
    user_id: str,
    plan: str,
    months: int,
    db: AsyncSession,
) -> dict:
    amount = get_plan_price(plan) * months
    merchant_uid = f"academi_{uuid.uuid4().hex[:16]}"

    payment = Payment(
        user_id=user_id,
        plan=plan,
        months=months,
        amount=amount,
        portone_payment_id=merchant_uid,
        status="pending",
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return {
        "payment_id": str(payment.id),
        "merchant_uid": merchant_uid,
        "amount": amount,
        "plan": plan,
    }


async def verify_and_complete(
    portone_payment_id: str,
    merchant_uid: str,
    db: AsyncSession,
) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.portone_payment_id == merchant_uid)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise PaymentVerificationError("결제 내역을 찾을 수 없습니다.")

    if USE_FIXTURES:
        payment.portone_payment_id = portone_payment_id or merchant_uid
        payment.status = "paid"
        payment.paid_at = datetime.now(timezone.utc)
        await db.commit()
        await upgrade_plan(str(payment.user_id), payment.plan, db, payment.months)
        await db.refresh(payment)
        return payment

    # 실제 PortOne 검증
    try:
        token = await _get_portone_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{PORTONE_API_BASE}/payments/{portone_payment_id}",
                headers={"Authorization": token},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()["response"]
    except httpx.HTTPError as e:
        raise PaymentVerificationError(f"PortOne API 오류: {e}")

    if data.get("status") != "paid":
        payment.status = "failed"
        await db.commit()
        raise PaymentVerificationError(f"결제 상태 오류: {data.get('status')}")

    if data.get("amount") != payment.amount:
        payment.status = "failed"
        await db.commit()
        raise PaymentVerificationError(
            f"결제 금액 불일치: 기대={payment.amount}, 실제={data.get('amount')}"
        )

    payment.portone_payment_id = portone_payment_id
    payment.status = "paid"
    payment.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await upgrade_plan(str(payment.user_id), payment.plan, db, payment.months)
    await db.refresh(payment)
    return payment


async def handle_webhook(data: dict, db: AsyncSession) -> dict:
    imp_uid = data.get("imp_uid")
    merchant_uid = data.get("merchant_uid")

    if not imp_uid or not merchant_uid:
        raise PaymentVerificationError("웹훅 페이로드 오류")

    payment = await verify_and_complete(imp_uid, merchant_uid, db)
    return {"status": payment.status, "payment_id": str(payment.id)}


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    if USE_FIXTURES:
        return True
    secret = settings.PORTONE_WEBHOOK_SECRET.encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
