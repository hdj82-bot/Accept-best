<<<<<<< HEAD
"""collect 태스크 테스트."""
from app.tasks.collect import collect_papers


def test_collect_returns_not_implemented():
    result = collect_papers("user-1", "transformer")
    assert result["status"] == "not_implemented"
    assert result["user_id"] == "user-1"
    assert result["keyword"] == "transformer"


def test_collect_task_config():
    assert collect_papers.name == "app.tasks.collect.collect_papers"
    assert collect_papers.queue == "collect"
    assert collect_papers.max_retries == 5


def test_collect_autoretry_on_rate_limit():
    from app.core.exceptions import RateLimitError

    autoretry = collect_papers.autoretry_for
    assert RateLimitError in autoretry
=======
"""논문 수집 태스크 단위 테스트.
외부 API 호출은 모킹하고, 파싱/저장 로직을 검증한다."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.tasks.collect import _fetch_arxiv, _fetch_semantic_scholar


ARXIV_SAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>Test Paper on Machine Learning</title>
    <summary>This is a test abstract about ML.</summary>
    <author><name>Alice Kim</name></author>
    <author><name>Bob Lee</name></author>
    <published>2024-01-15T00:00:00Z</published>
    <link title="pdf" href="http://arxiv.org/pdf/2401.00001v1" rel="related" type="application/pdf"/>
    <category term="cs.LG"/>
    <category term="cs.AI"/>
  </entry>
</feed>"""

SS_SAMPLE_JSON = {
    "total": 1,
    "data": [
        {
            "paperId": "abc123",
            "title": "Deep Learning Survey",
            "abstract": "A comprehensive survey on deep learning.",
            "authors": [{"name": "Charlie Park"}, {"name": "Dana Choi"}],
            "externalIds": {"DOI": "10.1234/test"},
            "url": "https://www.semanticscholar.org/paper/abc123",
            "publicationDate": "2024-03-01",
            "fieldsOfStudy": ["Computer Science", "Mathematics"],
            "openAccessPdf": {"url": "https://example.com/paper.pdf"},
        }
    ],
}


class TestFetchArxiv:
    @pytest.mark.asyncio
    @patch("app.tasks.collect.time.sleep")  # sleep 스킵
    async def test_parse_arxiv_response(self, mock_sleep):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = ARXIV_SAMPLE_XML

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_resp
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            papers = await _fetch_arxiv("machine learning", max_results=5)

        assert len(papers) == 1
        p = papers[0]
        assert p["source"] == "arxiv"
        assert p["source_id"] == "2401.00001v1"
        assert p["title"] == "Test Paper on Machine Learning"
        assert "Alice Kim" in p["author_ids"]
        assert "Bob Lee" in p["author_ids"]
        assert "cs.LG" in p["keywords"]
        assert p["pdf_url"] == "http://arxiv.org/pdf/2401.00001v1"
        assert p["published_at"] is not None

    @pytest.mark.asyncio
    @patch("app.tasks.collect.time.sleep")
    async def test_arxiv_rate_limit(self, mock_sleep):
        mock_resp = MagicMock()
        mock_resp.status_code = 429

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_resp
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            from app.core.exceptions import RateLimitError
            with pytest.raises(RateLimitError):
                await _fetch_arxiv("test")


class TestFetchSemanticScholar:
    @pytest.mark.asyncio
    @patch("app.tasks.collect.time.sleep")
    async def test_parse_ss_response(self, mock_sleep):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SS_SAMPLE_JSON

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_resp
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            papers = await _fetch_semantic_scholar("deep learning", max_results=5)

        assert len(papers) == 1
        p = papers[0]
        assert p["source"] == "semantic_scholar"
        assert p["source_id"] == "abc123"
        assert p["title"] == "Deep Learning Survey"
        assert "Charlie Park" in p["author_ids"]
        assert "Computer Science" in p["keywords"]
        assert p["pdf_url"] == "https://example.com/paper.pdf"
        assert p["published_at"] is not None

    @pytest.mark.asyncio
    @patch("app.tasks.collect.time.sleep")
    async def test_ss_rate_limit(self, mock_sleep):
        mock_resp = MagicMock()
        mock_resp.status_code = 429

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_resp
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client_cls.return_value = mock_client

            from app.core.exceptions import RateLimitError
            with pytest.raises(RateLimitError):
                await _fetch_semantic_scholar("test")
>>>>>>> origin/main
