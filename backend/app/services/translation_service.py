import deepl

from app.core.config import settings
from app.core.exceptions import ExternalAPIError
from app.schemas.translation import TranslationResponse

_translator: deepl.Translator | None = None


def _get_translator() -> deepl.Translator:
    global _translator
    if _translator is None:
        _translator = deepl.Translator(settings.DEEPL_API_KEY)
    return _translator


async def translate_text(
    text: str,
    source_lang: str = "KO",
    target_lang: str = "EN-US",
) -> TranslationResponse:
    translator = _get_translator()
    try:
        result = translator.translate_text(
            text,
            source_lang=source_lang,
            target_lang=target_lang,
        )
    except Exception as e:
        raise ExternalAPIError("DeepL", str(e))

    return TranslationResponse(
        original=text,
        translated=result.text,
        source_lang=source_lang,
        target_lang=target_lang,
    )
