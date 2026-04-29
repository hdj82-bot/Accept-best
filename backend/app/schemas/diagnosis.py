from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    paper_id: str = Field(..., min_length=1)


class IssueWithQuestion(BaseModel):
    """소크라테스식 정책: 단정형 결론 대신 사실 관찰 + 되묻는 질문 한 쌍."""

    section: str = Field(..., min_length=1)
    observation: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)


class DiagnosisRead(BaseModel):
    id: str
    paper_id: str
    user_id: str
    overall_score: int
    sections: dict[str, Any]
    recommendations: list[str]
    issues_with_questions: list[IssueWithQuestion] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DiagnosisListResponse(BaseModel):
    diagnoses: list[DiagnosisRead]
    total: int


class DiagnoseResponse(BaseModel):
    task_id: str
    message: str
    paper_id: str


class DiagnosisAnswerRequest(BaseModel):
    """연구자가 진단 결과의 되묻기 질문에 회신한 답변.

    context_id 는 보통 paper_id (또는 diagnosis id) 를 사용한다.
    """

    context_id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)


class DialogAnswerRead(BaseModel):
    id: str
    user_id: str
    service_name: str
    context_id: str
    question: str
    answer: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
