from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    paper_id: str = Field(..., min_length=1)


class DiagnosisRead(BaseModel):
    id: str
    paper_id: str
    user_id: str
    overall_score: int
    sections: dict[str, Any]
    recommendations: list[str]
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DiagnosisListResponse(BaseModel):
    diagnoses: list[DiagnosisRead]
    total: int


class DiagnoseResponse(BaseModel):
    task_id: str
    message: str
    paper_id: str
