from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PaperVersionCreate(BaseModel):
    content: dict[str, Any] = Field(...)
    save_type: str = Field(default="manual", pattern="^(auto|manual)$")


class PaperVersionRead(BaseModel):
    id: str
    user_id: str
    content: dict[str, Any]
    save_type: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaperVersionListResponse(BaseModel):
    versions: list[PaperVersionRead]
    total: int
