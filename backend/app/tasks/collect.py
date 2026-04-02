"""
Celery tasks for collecting papers from external APIs.

Queue: collect  (slow I/O-bound tasks — always include sleep(3) between API calls)
"""

import logging
from time import sleep

from app.core.exceptions import RateLimitError, ExternalAPIError
from app.tasks import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.tasks.collect.collect_arxiv_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_arxiv_papers(user_id: str, keyword: str, max_results: int = 20) -> dict:
    """
    Fetch papers from arXiv by keyword and persist them to the DB.

    Steps (stubbed):
    1. Query arXiv API (http://export.arxiv.org/api/query)
    2. Parse Atom feed entries
    3. Upsert into papers table (source='arxiv', source_id=<arxiv_id>)
    4. Enqueue process.summarize_and_embed_paper for each new paper
    5. Increment monthly_usage.research_count for user_id

    Rate-limit note: arXiv asks for >= 3 s between requests.
    """
    logger.info("collect_arxiv_papers: user=%s keyword=%s", user_id, keyword)

    # TODO: replace stub with real arXiv HTTP client
    sleep(3)  # mandatory courtesy delay for arXiv API

    return {
        "status": "ok",
        "source": "arxiv",
        "user_id": user_id,
        "keyword": keyword,
        "collected": 0,  # update once real logic is wired
    }


@celery_app.task(
    name="app.tasks.collect.collect_semantic_scholar_papers",
    queue="collect",
    autoretry_for=(RateLimitError,),
    retry_backoff=True,
    max_retries=5,
)
def collect_semantic_scholar_papers(
    user_id: str, keyword: str, max_results: int = 20
) -> dict:
    """
    Fetch papers from Semantic Scholar by keyword and persist them to the DB.

    Steps (stubbed):
    1. GET https://api.semanticscholar.org/graph/v1/paper/search
    2. Extract paperId, title, abstract, authors, year, citationCount
    3. Upsert into papers table (source='semantic_scholar', source_id=<paperId>)
    4. Enqueue process.summarize_and_embed_paper for each new paper
    5. Increment monthly_usage.research_count for user_id

    Rate-limit note: free tier allows 100 req/5 min; SS_API_KEY raises to 1,000/day.
    """
    logger.info(
        "collect_semantic_scholar_papers: user=%s keyword=%s", user_id, keyword
    )

    # TODO: replace stub with real Semantic Scholar HTTP client
    sleep(3)  # mandatory courtesy delay between API calls

    return {
        "status": "ok",
        "source": "semantic_scholar",
        "user_id": user_id,
        "keyword": keyword,
        "collected": 0,  # update once real logic is wired
    }
