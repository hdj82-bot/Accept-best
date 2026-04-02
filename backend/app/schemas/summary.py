from pydantic import BaseModel


class SummaryRead(BaseModel):
    paper_id: str
    title: str
    summary_ko: str
    key_findings: list[str]
    methodology: str
    limitations: str
