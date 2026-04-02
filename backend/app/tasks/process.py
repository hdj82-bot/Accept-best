"""
Celery tasks for processing papers: summarisation (Claude) and embedding (OpenAI).

Queue: process  (relatively fast; users may be waiting on results)
"""

import logging

import anthropic
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.core.exceptions import ExternalAPIError
from app.tasks import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()

_engine = create_async_engine(settings.database_url, pool_pre_ping=True)
_SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)


def _run_async(coro):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="app.tasks.process.summarize_paper",
    queue="process",
    max_retries=3,
)
def summarize_paper(paper_id: str) -> dict:
    logger.info("summarize_paper: paper_id=%s", paper_id)

    async def _run():
        from app.models.papers import Paper

        async with _SessionLocal() as session:
            result = await session.execute(
                select(Paper).where(Paper.id == paper_id)
            )
            paper = result.scalar_one_or_none()

        if paper is None:
            raise ExternalAPIError("DB", f"paper {paper_id} not found")

        prompt = f"Title: {paper.title}\n\nAbstract: {paper.abstract or ''}"

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{prompt}\n\n"
                        "위 논문을 한국어로 200자 이내로 요약해 주세요."
                    ),
                }
            ],
        )

        summary = message.content[0].text[:200]

        async with _SessionLocal() as session:
            async with session.begin():
                await session.execute(
                    text("UPDATE papers SET summary = :summary WHERE id = :id"),
                    {"summary": summary, "id": paper_id},
                )

        return summary

    summary = _run_async(_run())
    return {"status": "ok", "paper_id": paper_id, "task": "summarize", "summary": summary}


@celery_app.task(
    name="app.tasks.process.embed_paper",
    queue="process",
    max_retries=3,
)
def embed_paper(paper_id: str) -> dict:
    logger.info("embed_paper: paper_id=%s", paper_id)

    async def _run():
        from app.models.papers import Paper
        from app.services.embedding_service import get_embedding

        async with _SessionLocal() as session:
            result = await session.execute(
                select(Paper).where(Paper.id == paper_id)
            )
            paper = result.scalar_one_or_none()

        if paper is None:
            raise ExternalAPIError("DB", f"paper {paper_id} not found")

        text_input = f"{paper.title}\n\n{paper.abstract or ''}"
        embedding = get_embedding(text_input)

        async with _SessionLocal() as session:
            async with session.begin():
                await session.execute(
                    text("UPDATE papers SET embedding = :embedding WHERE id = :id"),
                    {"embedding": embedding, "id": paper_id},
                )

    _run_async(_run())
    return {"status": "ok", "paper_id": paper_id, "task": "embed", "dimensions": 1536}


@celery_app.task(
    name="app.tasks.process.generate_survey_questions",
    queue="process",
    max_retries=3,
)
def generate_survey_questions(paper_id: str, user_id: str) -> dict:
    logger.info(
        "generate_survey_questions: paper=%s user=%s", paper_id, user_id
    )

    import json

    async def _run():
        from app.models.papers import Paper
        from app.models.survey_questions import SurveyQuestion

        async with _SessionLocal() as session:
            result = await session.execute(
                select(Paper).where(Paper.id == paper_id)
            )
            paper = result.scalar_one_or_none()

        if paper is None:
            raise ExternalAPIError("DB", f"paper {paper_id} not found")

        prompt = (
            f"Title: {paper.title}\n\nAbstract: {paper.abstract or ''}\n\n"
            "논문 내용 기반으로 연구자가 논문 집필 시 참고할 수 있는 핵심 질문 5개를 생성하세요 (한국어). "
            'JSON 배열 형식으로만 반환하세요: [{"original_q": "원문질문", "adapted_q": "연구에 적용한 질문"}]'
        )

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        raw_text = message.content[0].text
        questions = json.loads(raw_text)

        created_ids = []
        async with _SessionLocal() as session:
            async with session.begin():
                for q in questions:
                    sq = SurveyQuestion(
                        user_id=user_id,
                        paper_id=paper_id,
                        original_q=q["original_q"],
                        adapted_q=q.get("adapted_q"),
                        source_title=paper.title,
                    )
                    session.add(sq)
                    await session.flush()
                    created_ids.append(str(sq.id))

        return created_ids

    created_ids = _run_async(_run())
    return {
        "status": "ok",
        "paper_id": paper_id,
        "user_id": user_id,
        "task": "survey",
        "question_ids": created_ids,
    }
