from app.core.exceptions import RateLimitError
from app.tasks import celery_app


@celery_app.task(
    name="app.tasks.collect.collect_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_papers(user_id: str, keyword: str) -> dict:
    """arXiv·Semantic Scholar에서 논문 수집 (Sprint 2에서 구현)."""
    return {"status": "not_implemented", "user_id": user_id, "keyword": keyword}
