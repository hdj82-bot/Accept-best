"""
Tests for export tasks and export API endpoints.

Runs with USE_FIXTURES=true — no real S3 or PDF rendering.
"""

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# Ensure fixture mode is on for all tests in this module
os.environ.setdefault("USE_FIXTURES", "true")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_note(note_id: str, user_id: str) -> MagicMock:
    note = MagicMock()
    note.id = note_id
    note.user_id = user_id
    note.content = "이것은 테스트 연구 노트 내용입니다."
    note.title = "테스트 노트"
    return note


def _make_question(paper_id: str) -> MagicMock:
    q = MagicMock()
    q.paper_id = paper_id
    q.adapted_q = "이 연구의 핵심 가설은 무엇인가?"
    q.original_q = "What is the key hypothesis?"
    return q


def _make_paper(paper_id: str) -> MagicMock:
    paper = MagicMock()
    paper.id = paper_id
    paper.title = "딥러닝 기반 논문 검색 연구"
    paper.source = "arxiv"
    paper.published_at = MagicMock()
    paper.published_at.year = 2024
    return paper


# ---------------------------------------------------------------------------
# Task tests
# ---------------------------------------------------------------------------

class TestExportMarkdownTask:
    """Tests for export_research_markdown Celery task."""

    def test_export_markdown_task(self, monkeypatch):
        """Call the task function directly (bypassing Celery), mock the DB, assert output."""
        monkeypatch.setenv("USE_FIXTURES", "true")

        note_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        paper_id = str(uuid.uuid4())

        fake_note = _make_note(note_id, user_id)
        fake_question = _make_question(paper_id)
        fake_paper = _make_paper(paper_id)

        # Build mock session that returns appropriate objects per query
        async def mock_execute(stmt, *args, **kwargs):
            mock_result = MagicMock()

            # Determine which model is being queried by inspecting the statement
            stmt_str = str(stmt)
            if "research_notes" in stmt_str:
                mock_result.scalar_one_or_none.return_value = fake_note
            elif "survey_questions" in stmt_str:
                mock_result.scalars.return_value.all.return_value = [fake_question]
            elif "papers" in stmt_str:
                mock_result.scalars.return_value.all.return_value = [fake_paper]
            else:
                mock_result.scalar_one_or_none.return_value = None
                mock_result.scalars.return_value.all.return_value = []
            return mock_result

        mock_session = AsyncMock()
        mock_session.execute = mock_execute

        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

        mock_session_local = MagicMock(return_value=mock_session_ctx)

        # Import the module under test and patch its _SessionLocal
        import app.tasks.export as export_module

        with patch.object(export_module, "_SessionLocal", mock_session_local):
            # Call the underlying function directly (not via .delay())
            result = export_module.export_research_markdown(note_id, user_id)

        assert isinstance(result, str), "Result should be a string"
        assert "## 참고 논문" in result, "Markdown should contain papers section"
        assert "## 연구 질문" in result, "Markdown should contain questions section"
        assert "## 작성 내용" in result, "Markdown should contain content section"

    def test_export_markdown_contains_note_content(self, monkeypatch):
        """Verify the note content appears in the markdown output."""
        monkeypatch.setenv("USE_FIXTURES", "true")

        note_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        fake_note = _make_note(note_id, user_id)

        async def mock_execute(stmt, *args, **kwargs):
            mock_result = MagicMock()
            stmt_str = str(stmt)
            if "research_notes" in stmt_str:
                mock_result.scalar_one_or_none.return_value = fake_note
            elif "survey_questions" in stmt_str:
                mock_result.scalars.return_value.all.return_value = []
            elif "papers" in stmt_str:
                mock_result.scalars.return_value.all.return_value = []
            else:
                mock_result.scalar_one_or_none.return_value = None
                mock_result.scalars.return_value.all.return_value = []
            return mock_result

        mock_session = AsyncMock()
        mock_session.execute = mock_execute

        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

        import app.tasks.export as export_module

        with patch.object(export_module, "_SessionLocal", MagicMock(return_value=mock_session_ctx)):
            result = export_module.export_research_markdown(note_id, user_id)

        assert fake_note.content in result


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

class TestExportStatusEndpoint:
    """Tests for GET /api/export/status/{task_id}."""

    @pytest.mark.asyncio
    async def test_export_status_endpoint(self, client):
        """Mock AsyncResult and verify the status endpoint returns expected fields."""
        task_id = str(uuid.uuid4())
        fake_url = "http://example.com/file.md"

        mock_async_result = MagicMock()
        mock_async_result.state = "SUCCESS"
        mock_async_result.result = fake_url

        with patch("app.api.export.celery_app") as mock_celery:
            mock_celery.AsyncResult.return_value = mock_async_result

            response = await client.get(f"/api/export/status/{task_id}")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data, "Response must contain 'status' field"
        assert "result" in data, "Response must contain 'result' field"
        assert data["status"] == "SUCCESS"
        assert data["result"] == fake_url

    @pytest.mark.asyncio
    async def test_export_markdown_trigger_endpoint(self, client):
        """Verify POST /api/export/markdown/{note_id} returns a task_id."""
        note_id = str(uuid.uuid4())

        mock_task = MagicMock()
        mock_task.id = str(uuid.uuid4())

        with patch("app.api.export.export_research_markdown") as mock_export:
            mock_export.delay.return_value = mock_task

            response = await client.post(f"/api/export/markdown/{note_id}")

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data

    @pytest.mark.asyncio
    async def test_export_pdf_trigger_endpoint(self, client):
        """Verify POST /api/export/pdf/{note_id} returns a task_id."""
        note_id = str(uuid.uuid4())

        mock_task = MagicMock()
        mock_task.id = str(uuid.uuid4())

        with patch("app.api.export.export_research_pdf") as mock_export:
            mock_export.delay.return_value = mock_task

            response = await client.post(f"/api/export/pdf/{note_id}")

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
