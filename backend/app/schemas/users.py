from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, ConfigDict


PlanType = Literal["free", "basic", "pro"]


class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    image: Optional[str] = None
    provider: str = "google"
    provider_account_id: Optional[str] = None
    plan: PlanType = "free"
    plan_expires_at: Optional[datetime] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    """사용자가 직접 수정 가능한 필드만 노출. plan/plan_expires_at은 결제 시스템에서만 변경."""
    name: Optional[str] = None
    image: Optional[str] = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
