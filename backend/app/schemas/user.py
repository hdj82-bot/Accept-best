from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: str
    email: EmailStr
    provider: str
    plan: str
    plan_expires_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    provider: str = "google"


class TokenVerifyResponse(BaseModel):
    user_id: str
    email: str
    plan: str
