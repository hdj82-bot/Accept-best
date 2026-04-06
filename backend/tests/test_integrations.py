"""
Integration tests for external API connections.

These tests verify that each external service handles:
1. Missing API keys gracefully (no crash)
2. Fixture mode returns expected shapes
3. Real API calls work when keys are present (skipped in CI)

Run with real keys:  USE_FIXTURES=false pytest tests/test_integrations.py -v
Run in CI/dev:       USE_FIXTURES=true  pytest tests/test_integrations.py -v
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import get_settings


# ─── Helpers ────────────────────────────────────────────────────────────────


def _has_key(name: str) -> bool:
    """Check if an API key is actually configured (non-empty)."""
    return bool(getattr(get_settings(), name, ""))


# ─── Anthropic (Claude) ────────────────────────────────────────────────────


class TestAnthropicIntegration:
    """Claude API via gap_service and rerank_service."""

    @pytest.mark.asyncio
    async def test_gap_service_no_api_key(self, monkeypatch):
        """gap_service returns fixture result when ANTHROPIC_API_KEY is empty."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "")
        get_settings.cache_clear()

        from app.services.gap_service import analyze_research_gap

        mock_db = AsyncMock()
        # Mock a note lookup that returns a note
        mock_note = MagicMock()
        mock_note.id = "00000000-0000-0000-0000-000000000001"
        mock_note.user_id = "00000000-0000-0000-0000-000000000002"

        mock_paper = MagicMock()
        mock_paper.title = "Test Paper"
        mock_paper.abstract = "Test abstract"
        mock_paper.created_at = MagicMock()

        # First call: note query, Second call: papers query
        note_result = MagicMock()
        note_result.scalar_one_or_none.return_value = mock_note

        papers_result = MagicMock()
        papers_result.scalars.return_value.all.return_value = [mock_paper]

        mock_db.execute = AsyncMock(side_effect=[note_result, papers_result])

        result = await analyze_research_gap(
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
            mock_db,
        )

        assert result["fixture"] is True
        assert "gaps" in result
        get_settings.cache_clear()

    @pytest.mark.asyncio
    async def test_rerank_no_api_key(self, monkeypatch):
        """rerank_papers returns fallback scores when ANTHROPIC_API_KEY is empty."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("ANTHROPIC_API_KEY", "")
        get_settings.cache_clear()

        from app.services.rerank_service import rerank_papers

        papers = [
            {"id": "1", "title": "Paper A", "abstract": "Abstract A"},
            {"id": "2", "title": "Paper B", "abstract": "Abstract B"},
        ]
        result = await rerank_papers("machine learning", papers, top_k=2)

        assert len(result) == 2
        assert result[0]["rerank_score"] == 0.5
        assert "not configured" in result[0]["rerank_reason"]
        get_settings.cache_clear()

    @pytest.mark.asyncio
    async def test_rerank_fixture_mode(self, monkeypatch):
        """rerank_papers returns 0.9 scores in fixture mode."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.rerank_service import rerank_papers

        papers = [{"id": "1", "title": "Test", "abstract": "Abstract"}]
        result = await rerank_papers("query", papers, top_k=1)

        assert len(result) == 1
        assert result[0]["rerank_score"] == 0.9
        assert result[0]["rerank_reason"] == "fixture mode"
        get_settings.cache_clear()

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not _has_key("anthropic_api_key"),
        reason="ANTHROPIC_API_KEY not set — skipping live API test",
    )
    async def test_rerank_live_api(self, monkeypatch):
        """rerank_papers calls Claude API successfully with a real key."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        get_settings.cache_clear()

        from app.services.rerank_service import rerank_papers

        papers = [
            {"id": "1", "title": "Deep Learning for NLP", "abstract": "A survey of deep learning methods for NLP tasks."},
            {"id": "2", "title": "Organic Chemistry Review", "abstract": "Latest developments in organic synthesis."},
        ]
        result = await rerank_papers("natural language processing", papers, top_k=2)

        assert len(result) == 2
        assert all(0.0 <= p["rerank_score"] <= 1.0 for p in result)
        # NLP paper should score higher than chemistry
        nlp_paper = next(p for p in result if p["id"] == "1")
        chem_paper = next(p for p in result if p["id"] == "2")
        assert nlp_paper["rerank_score"] > chem_paper["rerank_score"]
        get_settings.cache_clear()


# ─── DeepL (Translation) ───────────────────────────────────────────────────


class TestDeepLIntegration:
    """DeepL translation via translate_service."""

    @pytest.mark.asyncio
    async def test_translate_no_api_key(self, monkeypatch):
        """translate_text returns error info when DEEPL_API_KEY is empty."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("DEEPL_API_KEY", "")
        get_settings.cache_clear()

        from app.services.translate_service import translate_text

        result = await translate_text("Hello world")

        assert "error" in result
        assert "DEEPL_API_KEY" in result["error"]
        assert result["translated_text"] == "Hello world"
        get_settings.cache_clear()

    @pytest.mark.asyncio
    async def test_translate_fixture_mode(self, monkeypatch):
        """translate_text returns fixture preview in fixture mode."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.translate_service import translate_text

        result = await translate_text("Hello world")

        assert result["fixture"] is True
        assert "[번역 미리보기]" in result["translated_text"]
        get_settings.cache_clear()

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not _has_key("deepl_api_key"),
        reason="DEEPL_API_KEY not set — skipping live API test",
    )
    async def test_translate_live_api(self, monkeypatch):
        """translate_text returns Korean text via real DeepL API."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        get_settings.cache_clear()

        from app.services.translate_service import translate_text

        result = await translate_text("Hello world", target_lang="KO")

        assert "fixture" not in result
        assert "error" not in result
        assert len(result["translated_text"]) > 0
        get_settings.cache_clear()


# ─── OpenAI (Embeddings) ───────────────────────────────────────────────────


class TestOpenAIIntegration:
    """OpenAI embedding via embedding_service."""

    def test_embedding_no_api_key(self, monkeypatch):
        """get_embedding raises ExternalAPIError when OPENAI_API_KEY is empty."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("OPENAI_API_KEY", "")
        get_settings.cache_clear()

        from app.core.exceptions import ExternalAPIError
        from app.services.embedding_service import get_embedding

        with pytest.raises(ExternalAPIError, match="OPENAI_API_KEY"):
            get_embedding("test text")
        get_settings.cache_clear()

    def test_embedding_fixture_mode(self, monkeypatch):
        """get_embedding returns zero vector in fixture mode."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.embedding_service import get_embedding

        result = get_embedding("test text")

        assert isinstance(result, list)
        assert len(result) == 1536
        assert all(v == 0.0 for v in result)
        get_settings.cache_clear()

    def test_batch_embed_fixture_mode(self, monkeypatch):
        """batch_embed returns zero vectors in fixture mode."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.embedding_service import batch_embed

        result = batch_embed(["text 1", "text 2"])

        assert len(result) == 2
        assert all(len(v) == 1536 for v in result)
        get_settings.cache_clear()

    @pytest.mark.skipif(
        not _has_key("openai_api_key"),
        reason="OPENAI_API_KEY not set — skipping live API test",
    )
    def test_embedding_live_api(self, monkeypatch):
        """get_embedding returns a 1536-dim vector via real OpenAI API."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        get_settings.cache_clear()

        from app.services.embedding_service import get_embedding

        result = get_embedding("deep learning for natural language processing")

        assert isinstance(result, list)
        assert len(result) == 1536
        assert any(v != 0.0 for v in result)
        get_settings.cache_clear()


# ─── Gemini (Fallback LLM) ─────────────────────────────────────────────────


class TestGeminiIntegration:
    """Google Gemini via gemini_service."""

    @pytest.mark.asyncio
    async def test_gemini_no_api_key(self, monkeypatch):
        """generate_with_gemini returns empty string when key is missing."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("GEMINI_API_KEY", "")
        get_settings.cache_clear()

        from app.services.gemini_service import generate_with_gemini

        result = await generate_with_gemini("test prompt")

        assert result == ""
        get_settings.cache_clear()

    @pytest.mark.asyncio
    async def test_gemini_fixture_mode(self, monkeypatch):
        """generate_with_gemini returns fixture string."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.gemini_service import generate_with_gemini

        result = await generate_with_gemini("test prompt")

        assert "[Gemini fixture]" in result
        get_settings.cache_clear()

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not _has_key("gemini_api_key"),
        reason="GEMINI_API_KEY not set — skipping live API test",
    )
    async def test_gemini_live_api(self, monkeypatch):
        """generate_with_gemini returns non-empty text via real API."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        get_settings.cache_clear()

        from app.services.gemini_service import generate_with_gemini

        result = await generate_with_gemini("Say hello in Korean")

        assert len(result) > 0
        assert "[Gemini fixture]" not in result
        get_settings.cache_clear()


# ─── PortOne (Payment Webhook) ──────────────────────────────────────────────


class TestPortOneIntegration:
    """PortOne payment webhook signature verification."""

    def test_webhook_signature_fixture_mode(self, monkeypatch):
        """verify_webhook_signature returns True in fixture mode."""
        monkeypatch.setenv("USE_FIXTURES", "true")
        get_settings.cache_clear()

        from app.services.payment_service import verify_webhook_signature

        assert verify_webhook_signature(b"any body", "any-sig") is True
        get_settings.cache_clear()

    def test_webhook_signature_no_secret(self, monkeypatch):
        """verify_webhook_signature rejects when secret is missing."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("PORTONE_WEBHOOK_SECRET", "")
        get_settings.cache_clear()

        from app.services.payment_service import verify_webhook_signature

        assert verify_webhook_signature(b"body", "sig") is False
        get_settings.cache_clear()

    def test_webhook_signature_valid(self, monkeypatch):
        """verify_webhook_signature accepts a correctly signed payload."""
        import hashlib
        import hmac

        secret = "test-webhook-secret"
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("PORTONE_WEBHOOK_SECRET", secret)
        get_settings.cache_clear()

        body = b'{"imp_uid": "imp_123", "merchant_uid": "academi_abc"}'
        expected_sig = hmac.new(
            secret.encode(), body, hashlib.sha256
        ).hexdigest()

        from app.services.payment_service import verify_webhook_signature

        assert verify_webhook_signature(body, expected_sig) is True
        get_settings.cache_clear()

    def test_webhook_signature_invalid(self, monkeypatch):
        """verify_webhook_signature rejects a tampered payload."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("PORTONE_WEBHOOK_SECRET", "secret")
        get_settings.cache_clear()

        from app.services.payment_service import verify_webhook_signature

        assert verify_webhook_signature(b"body", "wrong-signature") is False
        get_settings.cache_clear()

    @pytest.mark.asyncio
    async def test_portone_token_no_keys(self, monkeypatch):
        """_get_portone_token raises PaymentVerificationError when keys missing."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("PORTONE_API_KEY", "")
        monkeypatch.setenv("PORTONE_API_SECRET", "")
        get_settings.cache_clear()

        from app.services.payment_service import PaymentVerificationError, _get_portone_token

        with pytest.raises(PaymentVerificationError, match="API 키"):
            await _get_portone_token()
        get_settings.cache_clear()


# ─── S3 Export Pipeline ─────────────────────────────────────────────────────


class TestS3ExportIntegration:
    """S3 upload in export tasks."""

    def test_markdown_export_no_aws_keys(self, monkeypatch):
        """export_research_markdown returns content directly when AWS keys missing."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "")
        monkeypatch.setenv("AWS_S3_BUCKET", "")
        get_settings.cache_clear()

        from unittest.mock import MagicMock, AsyncMock

        note = MagicMock()
        note.id = "note-1"
        note.user_id = "user-1"
        note.title = "테스트"
        note.content = "내용"

        async def mock_execute(stmt, *args, **kwargs):
            mock_result = MagicMock()
            stmt_str = str(stmt)
            if "research_notes" in stmt_str:
                mock_result.scalar_one_or_none.return_value = note
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
            result = export_module.export_research_markdown("note-1", "user-1")

        # Should return markdown content directly instead of crashing
        assert isinstance(result, str)
        assert "테스트" in result
        get_settings.cache_clear()

    def test_pdf_export_no_aws_keys(self, monkeypatch):
        """export_research_pdf raises ValueError when AWS keys missing."""
        monkeypatch.setenv("USE_FIXTURES", "false")
        monkeypatch.setenv("AWS_ACCESS_KEY_ID", "")
        monkeypatch.setenv("AWS_S3_BUCKET", "")
        get_settings.cache_clear()

        from unittest.mock import MagicMock, AsyncMock

        note = MagicMock()
        note.id = "note-1"
        note.user_id = "user-1"
        note.title = "테스트"
        note.content = "내용"

        async def mock_execute(stmt, *args, **kwargs):
            mock_result = MagicMock()
            stmt_str = str(stmt)
            if "research_notes" in stmt_str:
                mock_result.scalar_one_or_none.return_value = note
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

        with (
            patch.object(export_module, "_SessionLocal", MagicMock(return_value=mock_session_ctx)),
            patch("app.tasks.export.HTML") as mock_html,
            patch("app.tasks.export.md") as mock_md,
        ):
            mock_md.markdown.return_value = "<p>test</p>"
            mock_html.return_value.write_pdf.return_value = b"%PDF-fake"

            with pytest.raises(ValueError, match="AWS S3"):
                export_module.export_research_pdf("note-1", "user-1")
        get_settings.cache_clear()
