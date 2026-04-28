import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ExternalAPIError
from app.models.database import async_session
from app.models.paper import Paper
from app.tasks import celery_app


def _run_async(coro):
    """Celery 동기 워커에서 async 코루틴 실행."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_paper(db: AsyncSession, paper_id: str) -> Paper | None:
    result = await db.execute(select(Paper).where(Paper.id == paper_id))
    return result.scalar_one_or_none()


@celery_app.task(
    name="app.tasks.process.summarize_paper",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def summarize_paper(paper_id: str) -> dict:
    """Claude API로 논문 요약."""
    return _run_async(_summarize(paper_id))


async def _summarize(paper_id: str) -> dict:
    from app.services.summary_service import summarize_paper as do_summarize

    async with async_session() as db:
        paper = await _get_paper(db, paper_id)
        if not paper:
            return {"status": "error", "detail": "paper not found"}
        if not paper.abstract:
            return {"status": "skipped", "detail": "no abstract"}

        result = await do_summarize(paper_id, paper.title, paper.abstract)
        return result.model_dump()


@celery_app.task(
    name="app.tasks.process.generate_embedding",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def generate_embedding(paper_id: str) -> dict:
    """Gemini gemini-embedding-001 (1536-dim) 임베딩 생성 후 DB 저장."""
    return _run_async(_embed(paper_id))


async def _embed(paper_id: str) -> dict:
    from app.services.embedding_service import embed_and_save

    async with async_session() as db:
        paper = await _get_paper(db, paper_id)
        if not paper:
            return {"status": "error", "detail": "paper not found"}

        text = f"{paper.title} {paper.abstract or ''}"
        embedding = await embed_and_save(paper_id, text.strip(), db)
        return {
            "status": "ok",
            "paper_id": paper_id,
            "embedding_dim": len(embedding),
        }


@celery_app.task(
    name="app.tasks.process.generate_survey",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def generate_survey(user_id: str, paper_id: str) -> dict:
    """Claude API로 설문문항 자동 생성."""
    return _run_async(_generate_survey(user_id, paper_id))


async def _generate_survey(user_id: str, paper_id: str) -> dict:
    from app.services.survey_service import generate_survey_questions
    from app.services.usage import increment_usage

    async with async_session() as db:
        paper = await _get_paper(db, paper_id)
        if not paper:
            return {"status": "error", "detail": "paper not found"}
        if not paper.abstract:
            return {"status": "skipped", "detail": "no abstract"}

        questions = await generate_survey_questions(
            paper_id=paper_id,
            title=paper.title,
            abstract=paper.abstract,
            user_id=user_id,
            db=db,
        )
        await increment_usage(user_id, "survey_count", db)

        return {
            "status": "ok",
            "paper_id": paper_id,
            "questions_count": len(questions),
        }


@celery_app.task(
    name="app.tasks.process.diagnose_paper",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def diagnose_paper(user_id: str, paper_id: str) -> dict:
    """Claude API로 논문 건강검진."""
    return _run_async(_diagnose(user_id, paper_id))


async def _diagnose(user_id: str, paper_id: str) -> dict:
    from app.services.diagnosis_service import diagnose_paper as do_diagnose
    from app.services.usage import increment_usage

    async with async_session() as db:
        paper = await _get_paper(db, paper_id)
        if not paper:
            return {"status": "error", "detail": "paper not found"}
        if not paper.abstract:
            return {"status": "skipped", "detail": "no abstract"}

        diagnosis = await do_diagnose(
            paper_id=paper_id,
            title=paper.title,
            abstract=paper.abstract,
            user_id=user_id,
            db=db,
        )
        await increment_usage(user_id, "healthcheck_count", db)

        return {
            "status": "ok",
            "paper_id": paper_id,
            "overall_score": diagnosis.overall_score,
        }


@celery_app.task(
    name="app.tasks.process.note_to_draft",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def note_to_draft(user_id: str, note_id: str) -> dict:
    """연구 노트를 학술 논문 초안으로 변환."""
    return _run_async(_note_to_draft(user_id, note_id))


async def _note_to_draft(user_id: str, note_id: str) -> dict:
    from app.services.research_note_service import convert_note_to_draft
    from app.services.usage import increment_usage

    async with async_session() as db:
        try:
            draft = await convert_note_to_draft(note_id, user_id, db)
        except ValueError:
            return {"status": "error", "detail": "note not found"}

        await increment_usage(user_id, "research_count", db)

        return {
            "status": "ok",
            "note_id": note_id,
            "draft_length": len(draft),
        }


@celery_app.task(
    name="app.tasks.process.extract_references",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def extract_references(user_id: str, paper_id: str) -> dict:
    """Claude API로 논문에서 참고문헌 자동 추출."""
    return _run_async(_extract_references(user_id, paper_id))


async def _extract_references(user_id: str, paper_id: str) -> dict:
    from app.services.reference_service import auto_extract_references
    from app.services.usage import increment_usage

    async with async_session() as db:
        paper = await _get_paper(db, paper_id)
        if not paper:
            return {"status": "error", "detail": "paper not found"}
        if not paper.abstract:
            return {"status": "skipped", "detail": "no abstract"}

        refs = await auto_extract_references(
            paper_id=paper_id,
            title=paper.title,
            abstract=paper.abstract,
            user_id=user_id,
            db=db,
        )
        await increment_usage(user_id, "research_count", db)

        return {
            "status": "ok",
            "paper_id": paper_id,
            "references_count": len(refs),
        }


@celery_app.task(
    name="app.tasks.process.find_research_gaps",
    queue="process",
    autoretry_for=(ExternalAPIError,),
    retry_backoff=True,
    max_retries=3,
)
def find_research_gaps(user_id: str, paper_ids: list[str]) -> dict:
    """여러 논문 간 연구 공백 분석."""
    return _run_async(_find_research_gaps(user_id, paper_ids))


async def _find_research_gaps(user_id: str, paper_ids: list[str]) -> dict:
    from app.services.research_gap_service import find_research_gaps as do_find_gaps
    from app.services.usage import increment_usage

    async with async_session() as db:
        try:
            result = await do_find_gaps(paper_ids, user_id, db)
        except ValueError as e:
            return {"status": "error", "detail": str(e)}

        await increment_usage(user_id, "research_count", db)

        return {
            "status": "ok",
            "paper_count": len(paper_ids),
            **result,
        }
