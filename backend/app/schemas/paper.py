from datetime import datetime

from pydantic import BaseModel

from app.schemas.summary import SummaryRead


class PaperRead(BaseModel):
    id: str
    title: str
    abstract: str | None = None
    source: str
    source_id: str
    author_ids: list[str] | None = None
    keywords: list[str] | None = None
    published_at: datetime | None = None

    model_config = {"from_attributes": True}


class PaperDetail(PaperRead):
    summary: SummaryRead | None = None


class PaperSearchResponse(BaseModel):
    items: list[PaperRead]
    total: int
    page: int
    size: int


class SimilarPaperItem(BaseModel):
    paper: PaperRead
    score: float


class SimilarPaperResponse(BaseModel):
    paper_id: str
    items: list[SimilarPaperItem]


class CollectRequest(BaseModel):
    keyword: str


class CollectResponse(BaseModel):
    task_id: str
    status: str
