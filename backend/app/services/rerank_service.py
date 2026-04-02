"""
Rerank service: uses Claude Haiku to score paper relevance for a query.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)


async def rerank_papers(
    query: str,
    papers: list[dict],
    top_k: int = 5,
) -> list[dict]:
    """
    Rerank a list of paper dicts by relevance to *query* using Claude Haiku.

    Each paper dict must contain at least: id, title, abstract.
    Adds ``rerank_score`` (float 0-1) and ``rerank_reason`` (str) to every dict.
    Returns up to *top_k* papers sorted by score descending.

    When USE_FIXTURES=true (or papers is empty) returns papers as-is with
    fixture scores so tests / local dev never hit the real API.
    """
    use_fixtures = os.getenv("USE_FIXTURES", "true").lower() in ("1", "true", "yes")

    if use_fixtures or not papers:
        result = []
        for p in papers[:top_k]:
            p = dict(p)
            p["rerank_score"] = 0.9
            p["rerank_reason"] = "fixture mode"
            result.append(p)
        return result

    # ── Build numbered paper list for the prompt ───────────────────────────────
    lines: list[str] = []
    for i, p in enumerate(papers, start=1):
        abstract_snippet = (p.get("abstract") or "")[:200]
        lines.append(
            f"{i}. id={p.get('id')} | title={p.get('title')} | abstract={abstract_snippet}"
        )
    paper_list_str = "\n".join(lines)

    prompt = (
        f"연구 질문 '{query}'에 대해 아래 논문들의 관련성을 0.0~1.0으로 평가하라.\n"
        "JSON 배열로만 반환하라 (다른 텍스트 없이):\n"
        '[{"paper_id": "...", "relevance": 0.85, "reason": "한국어로 이유 설명"}]\n\n'
        f"논문 목록:\n{paper_list_str}"
    )

    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = message.content[0].text
        claude_results: list[dict] = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.warning("rerank_papers: JSON parse error (%s) — falling back to original order", exc)
        result = []
        for p in papers[:top_k]:
            p = dict(p)
            p["rerank_score"] = 0.5
            p["rerank_reason"] = "parse error fallback"
            result.append(p)
        return result
    except Exception as exc:
        logger.warning("rerank_papers: unexpected error (%s) — falling back to original order", exc)
        result = []
        for p in papers[:top_k]:
            p = dict(p)
            p["rerank_score"] = 0.5
            p["rerank_reason"] = "error fallback"
            result.append(p)
        return result

    # ── Match Claude scores back to original paper dicts ───────────────────────
    score_map: dict[str, tuple[float, str]] = {}
    for item in claude_results:
        pid = str(item.get("paper_id", ""))
        relevance = float(item.get("relevance", 0.0))
        reason = item.get("reason", "")
        score_map[pid] = (relevance, reason)

    enriched: list[dict] = []
    for p in papers:
        p = dict(p)
        pid = str(p.get("id", ""))
        if pid in score_map:
            p["rerank_score"], p["rerank_reason"] = score_map[pid]
        else:
            p["rerank_score"] = 0.0
            p["rerank_reason"] = ""
        enriched.append(p)

    enriched.sort(key=lambda x: x["rerank_score"], reverse=True)
    return enriched[:top_k]
