from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "academi",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_routes={
        "app.tasks.collect.*": {"queue": "collect"},
        "app.tasks.process.*": {"queue": "process"},
    },
)
