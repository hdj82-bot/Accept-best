import uuid
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db


class UserRow:
    """users 테이블 행을 나타내는 간단한 DTO.
    SQLAlchemy ORM 모델은 Sprint 0 백엔드(창2)에서 정의하므로
    여기서는 raw SQL + 경량 객체로 처리한다."""

    def __init__(self, *, id: str, email: str, provider: str, plan: str,
                 plan_expires_at=None, created_at=None, updated_at=None):
        self.id = id
        self.email = email
        self.provider = provider
        self.plan = plan
        self.plan_expires_at = plan_expires_at
        self.created_at = created_at
        self.updated_at = updated_at


async def get_user(user_id: str) -> UserRow | None:
    """user_id로 사용자를 조회한다."""
    async for db in get_db():
        result = await db.execute(
            text("SELECT id, email, provider, plan, plan_expires_at, created_at, updated_at "
                 "FROM users WHERE id = :id"),
            {"id": user_id},
        )
        row = result.mappings().first()
        if row is None:
            return None
        return UserRow(**row)


async def get_or_create_user(user_id: str, email: str = "", provider: str = "google") -> UserRow:
    """사용자가 없으면 생성하고, 있으면 반환한다.
    next-auth JWT의 sub(user_id)와 email을 사용한다."""
    user = await get_user(user_id)
    if user is not None:
        return user

    now = datetime.now(timezone.utc)
    new_id = user_id or str(uuid.uuid4())

    async for db in get_db():
        await db.execute(
            text(
                "INSERT INTO users (id, email, provider, plan, created_at, updated_at) "
                "VALUES (:id, :email, :provider, 'free', :now, :now) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": new_id, "email": email, "provider": provider, "now": now},
        )
        await db.commit()

    return UserRow(
        id=new_id, email=email, provider=provider,
        plan="free", plan_expires_at=None, created_at=now, updated_at=now,
    )
