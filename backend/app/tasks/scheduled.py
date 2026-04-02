"""
Celery beat scheduled tasks.

Queue: default
"""

import logging
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.tasks import celery_app

logger = logging.getLogger(__name__)

# Synchronous engine for Celery beat tasks
_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/academi",
).replace("postgresql+asyncpg://", "postgresql://").replace("+asyncpg", "")

_engine = create_engine(_DATABASE_URL, pool_pre_ping=True)
_SessionLocal = sessionmaker(bind=_engine)


@celery_app.task(name="app.tasks.scheduled.expire_plans")
def expire_plans() -> dict:
    """Expire paid plans whose plan_expires_at is in the past.

    Finds users where plan_expires_at < now() AND plan != 'free',
    resets them to plan='free' and clears plan_expires_at.
    """
    logger.info("expire_plans: checking for expired plans")

    with _SessionLocal() as session:
        result = session.execute(
            text(
                """
                UPDATE users
                SET plan = 'free', plan_expires_at = NULL, updated_at = now()
                WHERE plan_expires_at < now()
                  AND plan != 'free'
                """
            )
        )
        session.commit()
        updated = result.rowcount

    logger.info("expire_plans: updated %d users to free plan", updated)
    return {"updated": updated}


@celery_app.task(name="app.tasks.scheduled.cleanup_old_auto_versions")
def cleanup_old_auto_versions() -> dict:
    """Delete auto-save paper versions beyond the 10 newest per user."""
    logger.info("cleanup_old_auto_versions: pruning old auto-save versions")

    with _SessionLocal() as session:
        # Fetch distinct user IDs that have auto versions
        rows = session.execute(
            text("SELECT DISTINCT user_id FROM paper_versions WHERE save_type = 'auto'")
        ).fetchall()

        deleted_total = 0
        for (user_id,) in rows:
            # Find the 10th newest auto version created_at for this user
            cutoff_row = session.execute(
                text(
                    """
                    SELECT created_at
                    FROM paper_versions
                    WHERE user_id = :user_id AND save_type = 'auto'
                    ORDER BY created_at DESC
                    LIMIT 1
                    OFFSET 9
                    """
                ),
                {"user_id": user_id},
            ).fetchone()

            if cutoff_row is None:
                # Fewer than 10 auto versions — nothing to delete
                continue

            cutoff_at = cutoff_row[0]
            result = session.execute(
                text(
                    """
                    DELETE FROM paper_versions
                    WHERE user_id = :user_id
                      AND save_type = 'auto'
                      AND created_at < :cutoff_at
                    """
                ),
                {"user_id": user_id, "cutoff_at": cutoff_at},
            )
            deleted_total += result.rowcount

        session.commit()

    logger.info("cleanup_old_auto_versions: deleted %d old auto versions", deleted_total)
    return {"deleted": deleted_total}


@celery_app.task(name="app.tasks.scheduled.notify_expiring_plans")
def notify_expiring_plans() -> dict:
    """
    3일 내 만료 예정 유저를 조회하고 send_plan_expiry_warning 태스크를 호출.
    Beat schedule: 매일 09:00 UTC
    """
    logger.info("notify_expiring_plans: checking for plans expiring within 3 days")

    with _SessionLocal() as session:
        rows = session.execute(
            text(
                """
                SELECT id FROM users
                WHERE plan != 'free'
                  AND plan_expires_at IS NOT NULL
                  AND plan_expires_at BETWEEN now() AND now() + INTERVAL '3 days'
                """
            )
        ).fetchall()

    from app.tasks.notify import send_plan_expiry_warning  # noqa: PLC0415

    dispatched = 0
    for (user_id,) in rows:
        send_plan_expiry_warning.delay(str(user_id))
        dispatched += 1

    logger.info("notify_expiring_plans: dispatched %d warning emails", dispatched)
    return {"dispatched": dispatched}
