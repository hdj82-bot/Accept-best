from pydantic import BaseModel


class PlanLimit(BaseModel):
    research_count: int
    survey_count: int
    summary_count: int
    diagnosis_count: int


class PlanInfo(BaseModel):
    name: str
    display_name: str
    price_krw: int
    limits: PlanLimit


class UsageResponse(BaseModel):
    plan: str
    year_month: str
    usage: dict[str, int]
    limits: dict[str, int]
