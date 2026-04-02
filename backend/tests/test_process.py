import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.summary import SummaryRead


# ──────────────────────────────────────────────
# summarize_paper 태스크
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_summarize_paper_not_found():
    """존재하지 않는 paper_id → error 반환."""
    from app.tasks.process import _summarize

    fake_id = str(uuid.uuid4())

    mock_paper = None
    with patch("app.tasks.process.async_session") as mock_session_ctx:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_paper
        mock_db.execute.return_value = mock_result
        mock_session_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await _summarize(fake_id)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_summarize_paper_no_abstract():
    """abstract가 없는 논문 → skipped."""
    from app.tasks.process import _summarize

    fake_id = str(uuid.uuid4())
    mock_paper = MagicMock()
    mock_paper.abstract = None
    mock_paper.title = "Test Paper"

    with patch("app.tasks.process.async_session") as mock_session_ctx:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_paper
        mock_db.execute.return_value = mock_result
        mock_session_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await _summarize(fake_id)
    assert result["status"] == "skipped"


@pytest.mark.asyncio
async def test_summarize_paper_success():
    """정상 요약 → SummaryRead dict 반환."""
    from app.tasks.process import _summarize

    fake_id = str(uuid.uuid4())
    mock_paper = MagicMock()
    mock_paper.title = "Attention Is All You Need"
    mock_paper.abstract = "We propose a new architecture..."

    expected = SummaryRead(
        paper_id=fake_id,
        title="Attention Is All You Need",
        summary_ko="트랜스포머 아키텍처를 제안합니다.",
        key_findings=["셀프 어텐션", "병렬 처리"],
        methodology="인코더-디코더 구조",
        limitations="긴 시퀀스 처리 비용",
    )

    with (
        patch("app.tasks.process.async_session") as mock_session_ctx,
        patch("app.services.summary_service.summarize_paper", new_callable=AsyncMock, return_value=expected) as mock_summarize,
    ):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_paper
        mock_db.execute.return_value = mock_result
        mock_session_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await _summarize(fake_id)

    assert result["paper_id"] == fake_id
    assert result["summary_ko"] == "트랜스포머 아키텍처를 제안합니다."
    assert len(result["key_findings"]) == 2


# ──────────────────────────────────────────────
# generate_embedding 태스크
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_embed_paper_not_found():
    """존재하지 않는 paper → error."""
    from app.tasks.process import _embed

    fake_id = str(uuid.uuid4())

    with patch("app.tasks.process.async_session") as mock_session_ctx:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        mock_session_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await _embed(fake_id)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_embed_paper_success():
    """정상 임베딩 → 1536차원 확인."""
    from app.tasks.process import _embed

    fake_id = str(uuid.uuid4())
    mock_paper = MagicMock()
    mock_paper.title = "BERT"
    mock_paper.abstract = "We introduce BERT..."

    fake_embedding = [0.01] * 1536

    with (
        patch("app.tasks.process.async_session") as mock_session_ctx,
        patch("app.services.embedding_service.embed_and_save", new_callable=AsyncMock, return_value=fake_embedding),
    ):
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_paper
        mock_db.execute.return_value = mock_result
        mock_session_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_session_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await _embed(fake_id)

    assert result["status"] == "ok"
    assert result["embedding_dim"] == 1536


# ──────────────────────────────────────────────
# Celery 태스크 등록 확인
# ──────────────────────────────────────────────

def test_tasks_registered():
    from app.tasks import celery_app

    task_names = list(celery_app.tasks.keys())
    assert "app.tasks.process.summarize_paper" in task_names
    assert "app.tasks.process.generate_embedding" in task_names


def test_tasks_use_process_queue():
    from app.tasks import celery_app

    routes = celery_app.conf.task_routes
    assert routes["app.tasks.process.*"]["queue"] == "process"
