from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, ConfigDict


class PaperBase(BaseModel):
    source: str
    source_id: str
    title: str
    abstract: Optional[str] = None
    authors: Optional[List[str]] = None
    author_ids: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    published_at: Optional[datetime] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    citation_count: Optional[int] = 0
    summary: Optional[str] = None
    metadata_: Optional[Any] = None


class PaperCreate(PaperBase):
    embedding: Optional[List[float]] = None


class PaperUpdate(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    authors: Optional[List[str]] = None
    author_ids: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    published_at: Optional[datetime] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    citation_count: Optional[int] = None
    summary: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata_: Optional[Any] = None


class PaperRead(PaperBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # embedding is intentionally excluded from read schema to avoid serialising
    # large float arrays in list responses; use a dedicated endpoint if needed
    created_at: datetime
    updated_at: datetime
