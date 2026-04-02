from datetime import datetime

from pydantic import BaseModel


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
