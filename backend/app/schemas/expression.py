from pydantic import BaseModel


class ExpressionRequest(BaseModel):
    text: str
    context: str | None = None


class ExpressionItem(BaseModel):
    korean: str
    english: str
    usage_example: str


class ExpressionResponse(BaseModel):
    items: list[ExpressionItem]
