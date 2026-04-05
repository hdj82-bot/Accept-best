"""
Public meta endpoints — no authentication required.

Routes:
  GET /meta/stats    — total paper & user counts
  GET /meta/sitemap  — XML sitemap of shared notes
  GET /meta/og/{token} — Open Graph metadata for a shared note
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.papers import Paper
from app.models.users import User
from app.models.research_notes import ResearchNote

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Return total paper and user counts (cached 10 min)."""
    from app.services import cache_service

    cached = await cache_service.get(cache_service.meta_stats_key())
    if cached is not None:
        return cached

    paper_count_result = await db.execute(
        select(func.count()).select_from(Paper)
    )
    total_papers: int = paper_count_result.scalar_one()

    user_count_result = await db.execute(
        select(func.count()).select_from(User)
    )
    total_users: int = user_count_result.scalar_one()

    result = {"total_papers": total_papers, "total_users": total_users}
    await cache_service.set(cache_service.meta_stats_key(), result, ttl=cache_service.TTL_META)
    return result


@router.get("/sitemap")
async def get_sitemap(db: AsyncSession = Depends(get_db)):
    """Return an XML sitemap containing URLs for all shared research notes."""
    # ResearchNote model currently has no share_token column — return minimal sitemap.
    note_columns = {c.name for c in ResearchNote.__table__.columns}
    urls: list[str] = []

    if "share_token" in note_columns:
        result = await db.execute(
            select(ResearchNote).where(
                text("share_token IS NOT NULL")
            )
        )
        notes = result.scalars().all()
        urls = [
            f"https://academi.ai/notes/{note.share_token}"  # type: ignore[attr-defined]
            for note in notes
        ]

    url_entries = "\n".join(
        f"  <url><loc>{u}</loc></url>" for u in urls
    )
    xml_content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{url_entries}\n"
        "</urlset>"
    )
    return Response(content=xml_content, media_type="application/xml")


@router.get("/og/{token}")
async def get_og_metadata(token: str, db: AsyncSession = Depends(get_db)):
    """Return Open Graph metadata for a shared research note."""
    note_columns = {c.name for c in ResearchNote.__table__.columns}

    if "share_token" not in note_columns:
        raise HTTPException(status_code=404, detail="Note not found")

    result = await db.execute(
        select(ResearchNote).where(
            text(f"share_token = :token")
        ).params(token=token)
    )
    note = result.scalar_one_or_none()

    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    title = getattr(note, "title", None) or "Shared Research Note"
    content = getattr(note, "content", None) or ""
    description = content[:200] if content else ""

    return {
        "title": title,
        "description": description,
        "url": f"https://academi.ai/notes/{token}",
    }
