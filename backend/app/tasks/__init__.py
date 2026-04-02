import os

from celery import Celery
from celery.schedules import crontab

CELERY_TASK_ROUTES = {
    "app.tasks.collect.*": {"queue": "collect"},
    "app.tasks.process.*": {"queue": "process"},
    "app.tasks.export.*": {"queue": "export"},
    "app.tasks.scheduled.*": {"queue": "default"},
}

celery_app = Celery(
    "academi",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=[
        "app.tasks.collect",
        "app.tasks.process",
        "app.tasks.export",
        "app.tasks.scheduled",
        "app.tasks.notify",
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

celery_app.conf.beat_schedule = {
    "expire-plans-daily": {
        "task": "app.tasks.scheduled.expire_plans",
        "schedule": crontab(hour=0, minute=0),
    },
    "cleanup-versions-hourly": {
        "task": "app.tasks.scheduled.cleanup_old_auto_versions",
        "schedule": crontab(minute=0),
    },
    "notify-expiring-plans-daily": {
        "task": "app.tasks.scheduled.notify_expiring_plans",
        "schedule": crontab(hour=9, minute=0),  # 매일 09:00 UTC
    },
}
