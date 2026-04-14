from pydantic import BaseModel


class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "KO"
    target_lang: str = "EN-US"


class TranslationResponse(BaseModel):
    original: str
    translated: str
    source_lang: str
    target_lang: str
