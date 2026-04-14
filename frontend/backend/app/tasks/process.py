from app.tasks import celery_app


@celery_app.task(name="app.tasks.process.summarize_paper", queue="process")
def summarize_paper(paper_id: str) -> dict:
    """Claude API로 논문 요약 (Sprint 2에서 구현)."""
    return {"status": "not_implemented", "paper_id": paper_id}


@celery_app.task(name="app.tasks.process.generate_embedding", queue="process")
def generate_embedding(paper_id: str) -> dict:
    """text-embedding-3-small 임베딩 생성 (Sprint 2에서 구현)."""
    return {"status": "not_implemented", "paper_id": paper_id}
