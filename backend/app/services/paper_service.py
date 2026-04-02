import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.models.database import get_db


class PaperRow:
    """papers 테이블 행 DTO."""

    def __init__(self, *, id: str, title: str, abstract: str | None = None,
                 author_ids: list[str] | None = None, keywords: list[str] | None = None,
                 source: str, source_id: str, pdf_url: str | None = None,
                 published_at=None, created_at=None):
        self.id = id
        self.title = title
        self.abstract = abstract
        self.author_ids = author_ids
        self.keywords = keywords
        self.source = source
        self.source_id = source_id
        self.pdf_url = pdf_url
        self.published_at = published_at
        self.created_at = created_at


async def get_paper_by_source(source: str, source_id: str) -> PaperRow | None:
    """source+source_id로 중복 체크."""
    async for db in get_db():
        result = await db.execute(
            text(
                "SELECT id, title, abstract, author_ids, keywords, source, source_id, "
                "pdf_url, published_at, created_at "
                "FROM papers WHERE source = :source AND source_id = :source_id"
            ),
            {"source": source, "source_id": source_id},
        )
        row = result.mappings().first()
        if row is None:
            return None
        return PaperRow(**row)


async def save_paper(
    *,
    title: str,
    abstract: str | None = None,
    author_ids: list[str] | None = None,
    keywords: list[str] | None = None,
    source: str,
    source_id: str,
    pdf_url: str | None = None,
    published_at: datetime | None = None,
) -> PaperRow:
    """논문을 저장한다. 중복(source+source_id)이면 기존 행을 반환한다."""
    existing = await get_paper_by_source(source, source_id)
    if existing is not None:
        return existing

    paper_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    async for db in get_db():
        await db.execute(
            text(
                "INSERT INTO papers (id, title, abstract, author_ids, keywords, "
                "source, source_id, pdf_url, published_at, created_at) "
                "VALUES (:id, :title, :abstract, :author_ids, :keywords, "
                ":source, :source_id, :pdf_url, :published_at, :created_at) "
                "ON CONFLICT (source, source_id) DO NOTHING"
            ),
            {
                "id": paper_id, "title": title, "abstract": abstract,
                "author_ids": author_ids, "keywords": keywords,
                "source": source, "source_id": source_id,
                "pdf_url": pdf_url, "published_at": published_at,
                "created_at": now,
            },
        )
        await db.commit()

    return PaperRow(
        id=paper_id, title=title, abstract=abstract,
        author_ids=author_ids, keywords=keywords,
        source=source, source_id=source_id,
        pdf_url=pdf_url, published_at=published_at, created_at=now,
    )


async def list_papers(limit: int = 20, offset: int = 0) -> tuple[list[PaperRow], int]:
    """논문 목록을 조회한다."""
    async for db in get_db():
        count_result = await db.execute(text("SELECT count(*) FROM papers"))
        total = count_result.scalar() or 0

        result = await db.execute(
            text(
                "SELECT id, title, abstract, author_ids, keywords, source, source_id, "
                "pdf_url, published_at, created_at "
                "FROM papers ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
            ),
            {"limit": limit, "offset": offset},
        )
        rows = [PaperRow(**r) for r in result.mappings().all()]
        return rows, total

    return [], 0


async def get_paper(paper_id: str) -> PaperRow | None:
    """paper_id로 논문을 조회한다."""
    async for db in get_db():
        result = await db.execute(
            text(
                "SELECT id, title, abstract, author_ids, keywords, source, source_id, "
                "pdf_url, published_at, created_at "
                "FROM papers WHERE id = :id"
            ),
            {"id": paper_id},
        )
        row = result.mappings().first()
        if row is None:
            return None
        return PaperRow(**row)
