"""
Seed script: inserts fixture papers into the papers table.

Only runs when USE_FIXTURES=true (default in development).

Usage:
    python -m app.scripts.seed
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Fixtures path relative to this file: backend/tests/fixtures/papers.json
_FIXTURES_PATH = Path(__file__).parent.parent.parent.parent / "tests" / "fixtures" / "papers.json"
# Fallback: resolve relative to backend/ root
if not _FIXTURES_PATH.exists():
    _FIXTURES_PATH = Path(__file__).parent.parent.parent / "tests" / "fixtures" / "papers.json"


ZERO_VECTOR = [0.0] * 1536


async def seed():
    use_fixtures = os.getenv("USE_FIXTURES", "true").lower()
    if use_fixtures not in ("1", "true", "yes"):
        print("USE_FIXTURES is not set to true — skipping seed.")
        return

    if not _FIXTURES_PATH.exists():
        print(f"Fixtures file not found: {_FIXTURES_PATH}", file=sys.stderr)
        sys.exit(1)

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import text

    from app.core.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)

    raw = json.loads(_FIXTURES_PATH.read_text(encoding="utf-8"))
    papers = raw[:10]

    inserted = 0
    async with SessionLocal() as session:
        async with session.begin():
            for item in papers:
                result = await session.execute(
                    text("""
                        INSERT INTO papers (
                            id, source, source_id, title, abstract,
                            authors, keywords, embedding,
                            created_at, updated_at
                        )
                        VALUES (
                            gen_random_uuid(),
                            :source, :source_id, :title, :abstract,
                            :authors, :keywords, :embedding,
                            now(), now()
                        )
                        ON CONFLICT (source, source_id) DO NOTHING
                        RETURNING id
                    """),
                    {
                        "source": item.get("source", "arxiv"),
                        "source_id": item.get("source_id", ""),
                        "title": item.get("title", ""),
                        "abstract": item.get("abstract"),
                        "authors": item.get("authors"),
                        "keywords": item.get("keywords"),
                        "embedding": ZERO_VECTOR,
                    },
                )
                row = result.fetchone()
                if row:
                    inserted += 1

    print(f"Seed complete: {inserted}/{len(papers)} papers inserted.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
