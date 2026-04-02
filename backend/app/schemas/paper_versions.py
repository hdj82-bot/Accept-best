from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any, Literal

from pydantic import BaseModel, ConfigDict


SaveType = Literal["auto", "manual"]


class PaperVersionBase(BaseModel):
    user_id: uuid.UUID
    content: Any  # JSONB — arbitrary draft structure
    save_type: SaveType = "auto"
    label: Optional[str] = None


class PaperVersionCreate(PaperVersionBase):
    pass


class PaperVersionUpdate(BaseModel):
    content: Optional[Any] = None
    label: Optional[str] = None


class PaperVersionRead(PaperVersionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
