from datetime import datetime

from pydantic import BaseModel, Field


class SurveyGenerateRequest(BaseModel):
    paper_id: str = Field(..., min_length=1)


class SurveyRead(BaseModel):
    id: str
    paper_id: str
    original_q: str
    adapted_q: str
    source_title: str | None = None
    source_page: int | None = None
    year: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SurveyListResponse(BaseModel):
    survey_questions: list[SurveyRead]
    total: int


class SurveyGenerateResponse(BaseModel):
    task_id: str
    message: str
    paper_id: str
