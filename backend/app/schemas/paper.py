from datetime import datetime

from pydantic import BaseModel, Field


class PaperSearchRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    source: str = Field(default="all", pattern="^(all|arxiv|semantic_scholar)$")
    max_results: int = Field(default=10, ge=1, le=50)


class PaperRead(BaseModel):
    id: str
    title: str
    abstract: str | None = None
    author_ids: list[str] | None = None
    keywords: list[str] | None = None
    source: str
    source_id: str
    pdf_url: str | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaperSearchResponse(BaseModel):
    task_id: str
    message: str
    keyword: str
    source: str


class PaperListResponse(BaseModel):
    papers: list[PaperRead]
    total: int
