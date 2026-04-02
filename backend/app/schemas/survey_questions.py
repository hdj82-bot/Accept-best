from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SurveyQuestionBase(BaseModel):
    user_id: uuid.UUID
    paper_id: Optional[uuid.UUID] = None
    original_q: str
    adapted_q: Optional[str] = None
    source_title: Optional[str] = None
    source_page: Optional[int] = None
    year: Optional[int] = None


class SurveyQuestionCreate(SurveyQuestionBase):
    pass


class SurveyQuestionUpdate(BaseModel):
    adapted_q: Optional[str] = None
    source_title: Optional[str] = None
    source_page: Optional[int] = None
    year: Optional[int] = None


class SurveyQuestionRead(SurveyQuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
