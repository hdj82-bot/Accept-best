from pydantic import BaseModel, Field


class SummaryRead(BaseModel):
    paper_id: str
    title: str
    summary_ko: str
    key_findings: list[str]
    methodology: str
    limitations: str
    follow_up_questions: list[str] = Field(default_factory=list)
