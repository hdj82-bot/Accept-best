from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MonthlyUsageBase(BaseModel):
    user_id: uuid.UUID
    year_month: str  # "YYYY-MM"
    research_count: int = 0
    summary_count: int = 0
    survey_count: int = 0
    embedding_count: int = 0


class MonthlyUsageCreate(MonthlyUsageBase):
    pass


class MonthlyUsageUpdate(BaseModel):
    research_count: Optional[int] = None
    summary_count: Optional[int] = None
    survey_count: Optional[int] = None
    embedding_count: Optional[int] = None


class MonthlyUsageRead(MonthlyUsageBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
