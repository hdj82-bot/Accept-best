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
    """text-embedding-3-small 임베딩 생성 후 DB 저장."""
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
