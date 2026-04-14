from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ReferenceCreate(BaseModel):
    title: str = Field(..., min_length=1)
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    citation_text: str | None = None
    memo: str | None = None
    paper_id: str | None = None


class ReferenceUpdate(BaseModel):
    title: str | None = None
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    citation_text: str | None = None
    memo: str | None = None


class ReferenceRead(BaseModel):
    id: str
    user_id: str
    paper_id: str | None = None
    title: str
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None
    citation_text: str | None = None
    memo: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReferenceListResponse(BaseModel):
    references: list[ReferenceRead]
    total: int


class ExtractReferencesRequest(BaseModel):
    paper_id: str = Field(..., min_length=1)


class ExtractReferencesResponse(BaseModel):
    task_id: str
    message: str
    paper_id: str


class ResearchGapRequest(BaseModel):
    paper_ids: list[str] = Field(..., min_length=2, max_length=10)


class ResearchGapResponse(BaseModel):
    task_id: str
    message: str


class ResearchGapRead(BaseModel):
    gaps: list[dict[str, Any]]
    connections: list[dict[str, Any]]
    suggestions: list[str]
