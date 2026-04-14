"""papers API 스키마 및 서비스 로직 테스트."""

import pytest

from app.schemas.paper import PaperSearchRequest, PaperRead, PaperListResponse


class TestPaperSchemas:
    def test_search_request_defaults(self):
        req = PaperSearchRequest(keyword="deep learning")
        assert req.source == "all"
        assert req.max_results == 10

    def test_search_request_custom(self):
        req = PaperSearchRequest(keyword="transformer", source="arxiv", max_results=20)
        assert req.keyword == "transformer"
        assert req.source == "arxiv"
        assert req.max_results == 20

    def test_search_request_invalid_source(self):
        with pytest.raises(Exception):
            PaperSearchRequest(keyword="test", source="invalid_source")

    def test_search_request_empty_keyword(self):
        with pytest.raises(Exception):
            PaperSearchRequest(keyword="")

    def test_search_request_max_results_bounds(self):
        with pytest.raises(Exception):
            PaperSearchRequest(keyword="test", max_results=0)
        with pytest.raises(Exception):
            PaperSearchRequest(keyword="test", max_results=51)

    def test_paper_read_from_dict(self):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        paper = PaperRead(
            id="test-id",
            title="Test Paper",
            abstract="Abstract text",
            author_ids=["Author A"],
            keywords=["cs.LG"],
            source="arxiv",
            source_id="2401.00001",
            pdf_url="http://example.com/paper.pdf",
            published_at=now,
            created_at=now,
        )
        assert paper.id == "test-id"
        assert paper.source == "arxiv"
        assert len(paper.author_ids) == 1

    def test_paper_list_response(self):
        resp = PaperListResponse(papers=[], total=0)
        assert resp.total == 0
        assert resp.papers == []
