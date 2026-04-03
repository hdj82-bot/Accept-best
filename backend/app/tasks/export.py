"""
Celery tasks for exporting research notes to Markdown and PDF.

Queue: export
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.core.metrics import export_jobs_total
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


def _build_markdown(note, questions, papers) -> str:
    title = getattr(note, "title", None) or "연구 노트"

    lines = [f"# {title}", ""]

    # Reference papers section
    lines.append(f"## 참고 논문 ({len(papers)}건)")
    for paper in papers:
        year = getattr(paper, "year", None)
        if year is None and getattr(paper, "published_at", None) is not None:
            year = paper.published_at.year
        year_str = f" ({year})" if year else ""
        source = getattr(paper, "source", "") or ""
        lines.append(f"- {paper.title}{year_str} — {source}")
    lines.append("")

    # Survey questions section
    lines.append("## 연구 질문")
    for i, question in enumerate(questions, start=1):
        adapted = getattr(question, "adapted_q", None) or getattr(question, "original_q", "")
        lines.append(f"{i}. {adapted}")
    lines.append("")

    # Note content section
    lines.append("## 작성 내용")
    lines.append(note.content or "")

    return "\n".join(lines)


@celery_app.task(
    name="app.tasks.export.export_research_markdown",
    queue="export",
    max_retries=3,
)
def export_research_markdown(note_id: str, user_id: str) -> str:
    logger.info("export_research_markdown: note_id=%s user_id=%s", note_id, user_id)

    async def _run():
        from app.models.research_notes import ResearchNote
        from app.models.survey_questions import SurveyQuestion
        from app.models.papers import Paper

        # Fetch the research note
        async with _SessionLocal() as session:
            result = await session.execute(
                select(ResearchNote).where(ResearchNote.id == note_id)
            )
            note = result.scalar_one_or_none()

        if note is None:
            raise ValueError(f"ResearchNote {note_id} not found")

        # Fetch related survey questions for this user
        async with _SessionLocal() as session:
            result = await session.execute(
                select(SurveyQuestion).where(SurveyQuestion.user_id == user_id)
            )
            questions = list(result.scalars().all())

        # Fetch referenced papers (papers linked to the questions)
        paper_ids = list({str(q.paper_id) for q in questions if q.paper_id is not None})
        papers = []
        if paper_ids:
            async with _SessionLocal() as session:
                result = await session.execute(
                    select(Paper).where(Paper.id.in_(paper_ids))
                )
                papers = list(result.scalars().all())

        return _build_markdown(note, questions, papers)

    markdown_str = _run_async(_run())

    if settings.use_fixtures:
        export_jobs_total.labels(format="markdown", status="success").inc()
        from app.tasks.notify import send_research_complete  # noqa: PLC0415
        send_research_complete.delay(user_id, note_id, "fixtures://markdown")
        return markdown_str

    if not settings.aws_access_key_id or not settings.aws_s3_bucket:
        logger.warning("AWS credentials not set — returning markdown content directly")
        export_jobs_total.labels(format="markdown", status="success").inc()
        return markdown_str

    # Upload to S3 and return presigned URL
    import boto3

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    bucket = settings.aws_s3_bucket
    key = f"{user_id}/exports/{note_id}.md"

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=markdown_str.encode("utf-8"),
        ContentType="text/markdown; charset=utf-8",
    )

    url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=3600,
    )
    export_jobs_total.labels(format="markdown", status="success").inc()
    from app.tasks.notify import send_research_complete  # noqa: PLC0415
    send_research_complete.delay(user_id, note_id, url)
    return url


@celery_app.task(
    name="app.tasks.export.export_research_pdf",
    queue="export",
    max_retries=3,
)
def export_research_pdf(note_id: str, user_id: str) -> str:
    logger.info("export_research_pdf: note_id=%s user_id=%s", note_id, user_id)

    async def _run():
        from app.models.research_notes import ResearchNote
        from app.models.survey_questions import SurveyQuestion
        from app.models.papers import Paper

        async with _SessionLocal() as session:
            result = await session.execute(
                select(ResearchNote).where(ResearchNote.id == note_id)
            )
            note = result.scalar_one_or_none()

        if note is None:
            raise ValueError(f"ResearchNote {note_id} not found")

        async with _SessionLocal() as session:
            result = await session.execute(
                select(SurveyQuestion).where(SurveyQuestion.user_id == user_id)
            )
            questions = list(result.scalars().all())

        paper_ids = list({str(q.paper_id) for q in questions if q.paper_id is not None})
        papers = []
        if paper_ids:
            async with _SessionLocal() as session:
                result = await session.execute(
                    select(Paper).where(Paper.id.in_(paper_ids))
                )
                papers = list(result.scalars().all())

        return _build_markdown(note, questions, papers)

    markdown_str = _run_async(_run())

    if settings.use_fixtures:
        export_jobs_total.labels(format="pdf", status="success").inc()
        return "fixtures_pdf_export"

    # Convert markdown -> HTML -> PDF
    import markdown as md
    from weasyprint import HTML

    html_content = md.markdown(markdown_str)
    pdf_bytes = HTML(string=html_content).write_pdf()

    if not settings.aws_access_key_id or not settings.aws_s3_bucket:
        logger.warning("AWS credentials not set — cannot upload PDF to S3")
        export_jobs_total.labels(format="pdf", status="error").inc()
        raise ValueError("AWS S3 credentials not configured for PDF export")

    # Upload to S3 and return presigned URL
    import boto3

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    bucket = settings.aws_s3_bucket
    key = f"{user_id}/exports/{note_id}.pdf"

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=pdf_bytes,
        ContentType="application/pdf",
    )

    url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=3600,
    )
    export_jobs_total.labels(format="pdf", status="success").inc()
    return url
