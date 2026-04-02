from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: str
    email: EmailStr
    provider: str
    plan: str
    plan_expires_at: datetime | None = None

    model_config = {"from_attributes": True}
