from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SurveyGenerateRequest(BaseModel):
    """소크라테스식 2단계 흐름의 단일 요청 스키마.

    stage='pre' (1차)  : user_answers 없이 paper_id만으로 사전 질문을 받는다.
    stage='final' (2차): paper_id + user_answers(선택)로 최종 문항을 받는다.
                         user_answers가 비어 있어도 일반 권장값 fallback으로 동작.
    """

    paper_id: str = Field(..., min_length=1)
    user_answers: dict[str, str] | None = None
    variable: str | None = None


class SurveyPreQuestionsResponse(BaseModel):
    stage: Literal["pre"] = "pre"
    questions: list[str]


class SurveyItem(BaseModel):
    id: str
    paper_id: str
    original_q: str
    adapted_q: str
    source_title: str | None = None
    source_page: int | None = None
    year: int | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SurveyFinalResponse(BaseModel):
    stage: Literal["final"] = "final"
    items: list[SurveyItem]


class SurveyRead(SurveyItem):
    """GET 엔드포인트 호환 별칭."""


class SurveyListResponse(BaseModel):
    survey_questions: list[SurveyRead]
    total: int
