from pydantic import BaseModel


class MonthlyUsageRead(BaseModel):
    user_id: str
    year_month: str
    research_count: int = 0
    survey_count: int = 0
    summary_count: int = 0
    diagnosis_count: int = 0

    model_config = {"from_attributes": True}
