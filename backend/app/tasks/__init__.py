import os

from celery import Celery

CELERY_TASK_ROUTES = {
    "app.tasks.collect.*": {"queue": "collect"},
    "app.tasks.process.*": {"queue": "process"},
    "app.tasks.export.*": {"queue": "export"},
}

celery_app = Celery(
    "academi",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=[
        "app.tasks.collect",
        "app.tasks.process",
        "app.tasks.export",
    ],
)

celery_app.conf.update(
    task_routes=CELERY_TASK_ROUTES,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry configuration
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
)
