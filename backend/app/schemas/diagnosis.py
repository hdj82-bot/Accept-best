from pydantic import BaseModel


class DiagnosisItem(BaseModel):
    label: str
    score: int


class DiagnosisResult(BaseModel):
    paper_id: str
    items: list[DiagnosisItem]
    total_score: int
    feedback: str
    suggestions: list[str]
