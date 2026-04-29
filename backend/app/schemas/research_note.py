from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str | None = None
    content: str = Field(..., min_length=1)


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = Field(default=None, min_length=1)


class NoteRead(BaseModel):
    id: str
    user_id: str
    title: str | None = None
    content: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class NoteListResponse(BaseModel):
    notes: list[NoteRead]
    total: int


class NoteToDraftRequest(BaseModel):
    note_id: str = Field(..., min_length=1)
    user_answers: dict[str, str] | None = None


class NoteToDraftQuestionsResponse(BaseModel):
    stage: Literal["questions"] = "questions"
    note_id: str
    questions: list[str]


class NoteToDraftResponse(BaseModel):
    stage: Literal["draft"] = "draft"
    task_id: str
    message: str
    note_id: str
