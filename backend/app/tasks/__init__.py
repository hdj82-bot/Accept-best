import os

from celery import Celery
from app.core.config import settings

CELERY_ENABLED = bool(settings.REDIS_URL) and os.getenv("CELERY_DISABLED") != "1"

celery_app = Celery(
    "academi",
    broker=settings.REDIS_URL or "memory://",
    backend=settings.REDIS_URL or "rpc://",
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
    task_always_eager=not CELERY_ENABLED,
    task_eager_propagates=True,
)
