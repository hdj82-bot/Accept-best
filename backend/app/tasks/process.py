"""
Celery tasks for processing papers: summarisation (Claude) and embedding (OpenAI).

Queue: process  (relatively fast; users may be waiting on results)
"""

import logging

from app.core.exceptions import ExternalAPIError
from app.tasks import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.process.summarize_paper",
    queue="process",
    max_retries=3,
)
def summarize_paper(paper_id: str) -> dict:
    """
    Generate a structured summary for a paper using Claude API.

    Steps (stubbed):
    1. Load paper from DB by paper_id
    2. Build prompt from title + abstract
    3. Call Anthropic Claude (claude-3-5-sonnet) with structured output
    4. Persist summary back to papers.summary
    5. Increment monthly_usage.summary_count for owning user

    Raises ExternalAPIError on Anthropic API failure.
    """
    logger.info("summarize_paper: paper_id=%s", paper_id)

    # TODO: wire up Anthropic client
    # import anthropic
    # client = anthropic.Anthropic()
    # message = client.messages.create(...)

    return {
        "status": "ok",
        "paper_id": paper_id,
        "task": "summarize",
    }


@celery_app.task(
    name="app.tasks.process.embed_paper",
    queue="process",
    max_retries=3,
)
def embed_paper(paper_id: str) -> dict:
    """
    Generate and store a 1536-dim embedding for a paper using OpenAI
    text-embedding-3-small.

    Steps (stubbed):
    1. Load paper from DB by paper_id
    2. Concatenate title + abstract as embed input
    3. Call openai.embeddings.create(model="text-embedding-3-small")
    4. Persist vector to papers.embedding (pgvector)
    5. Increment monthly_usage.embedding_count for owning user

    The embedding dimension MUST stay at 1536 — changing it requires full
    table re-embedding (see CLAUDE.md).

    Raises ExternalAPIError on OpenAI API failure.
    """
    logger.info("embed_paper: paper_id=%s", paper_id)

    # TODO: wire up OpenAI client
    # import openai
    # client = openai.OpenAI()
    # response = client.embeddings.create(
    #     model="text-embedding-3-small",
    #     input=text,
    # )
    # vector = response.data[0].embedding  # len == 1536

    return {
        "status": "ok",
        "paper_id": paper_id,
        "task": "embed",
        "dimensions": 1536,
    }


@celery_app.task(
    name="app.tasks.process.generate_survey_questions",
    queue="process",
    max_retries=3,
)
def generate_survey_questions(user_id: str, paper_id: str) -> dict:
    """
    Auto-generate survey questions from a paper using Claude API.

    Steps (stubbed):
    1. Load paper from DB by paper_id
    2. Build prompt asking Claude to extract / adapt survey questions
    3. Parse structured response into SurveyQuestion rows
    4. Persist to survey_questions table
    5. Increment monthly_usage.survey_count for user_id

    This is the core differentiator feature of academi.ai.
    """
    logger.info(
        "generate_survey_questions: user=%s paper=%s", user_id, paper_id
    )

    # TODO: wire up Anthropic client for survey generation

    return {
        "status": "ok",
        "user_id": user_id,
        "paper_id": paper_id,
        "task": "survey",
    }
