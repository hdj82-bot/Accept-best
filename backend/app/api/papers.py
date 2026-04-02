from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.models.papers import Paper
from app.schemas.papers import PaperRead
from app.services import paper_service
from app.services.embedding_service import get_embedding

router = APIRouter()
settings = get_settings()

_engine = create_async_engine(settings.database_url, pool_pre_ping=True)
_SessionLocal = async_sessionmaker(bind=_engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with _SessionLocal() as session:
        yield session


class SearchBody(BaseModel):
    query: str


class CollectBody(BaseModel):
    query: str
    source: str


@router.post("/papers/search", response_model=list[PaperRead])
async def search_papers(body: SearchBody, db: AsyncSession = Depends(get_db)):
    embedding = get_embedding(body.query)
    papers = await paper_service.search_similar(embedding, db, limit=10)
    return papers


@router.get("/papers/{paper_id}", response_model=PaperRead)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await paper_service.get_paper(paper_id, db)
    if paper is None:
        raise NotFoundError("paper")
    return paper


@router.post("/papers/collect")
async def collect_papers(body: CollectBody):
    from app.tasks.collect import collect_arxiv_papers, collect_semantic_scholar_papers

    if body.source == "arxiv":
        task = collect_arxiv_papers.apply_async(args=[body.query])
    elif body.source == "semantic_scholar":
        task = collect_semantic_scholar_papers.apply_async(args=[body.query])
    else:
        task = collect_arxiv_papers.apply_async(args=[body.query])

    return {"task_id": task.id, "source": body.source}
