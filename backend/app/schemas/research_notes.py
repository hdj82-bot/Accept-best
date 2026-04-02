from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ResearchNoteBase(BaseModel):
    user_id: uuid.UUID
    content: str


class ResearchNoteCreate(ResearchNoteBase):
    pass


class ResearchNoteUpdate(BaseModel):
    content: Optional[str] = None


class ResearchNoteRead(ResearchNoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
