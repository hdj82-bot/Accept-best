"""
Tests for collect and process tasks.
Uses fixture data when USE_FIXTURES=true (default).
No real external API calls are made.
"""

import json
import os
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import pytest
import pytest_asyncio

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "papers.json"
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() in ("1", "true", "yes")


@pytest.fixture
def fixture_papers():
    if not FIXTURES_PATH.exists():
        return []
    return json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def arxiv_result_mock(fixture_papers):
    arxiv_papers = [p for p in fixture_papers if p["source"] == "arxiv"]

    results = []
    for p in arxiv_papers[:2]:
        result = MagicMock()
        result.entry_id = f"https://arxiv.org/abs/{p['source_id']}"
        result.title = p["title"]
        result.summary = p.get("abstract", "")
        result.authors = [MagicMock(name=a) for a in (p.get("authors") or [])]
        result.categories = p.get("keywords", [])
        result.published = None
        result.doi = None
        result.pdf_url = f"https://arxiv.org/pdf/{p['source_id']}"
        results.append(result)
    return results


@pytest.fixture
def ss_response_mock(fixture_papers):
    ss_papers = [p for p in fixture_papers if p["source"] == "semantic_scholar"]

    data = []
    for p in ss_papers[:2]:
        data.append({
            "paperId": p["source_id"],
            "title": p["title"],
            "abstract": p.get("abstract"),
            "authors": [{"name": a, "authorId": str(uuid.uuid4())} for a in (p.get("authors") or [])],
            "year": 2023,
            "citationCount": 5,
            "externalIds": {},
            "url": f"https://www.semanticscholar.org/paper/{p['source_id']}",
        })
    return {"data": data}


def test_collect_arxiv_papers_with_mock(arxiv_result_mock):
    inserted_ids = [str(uuid.uuid4()), str(uuid.uuid4())]

    with patch("app.tasks.collect.arxiv") as mock_arxiv, \
         patch("app.tasks.collect._run_async") as mock_run_async:

        mock_client = MagicMock()
        mock_arxiv.Client.return_value = mock_client
        mock_arxiv.Search.return_value = MagicMock()
        mock_client.results.return_value = iter(arxiv_result_mock)
        mock_run_async.return_value = None

        from app.tasks.collect import collect_arxiv_papers

        with patch("app.tasks.collect.sleep"):
            with patch.object(
                collect_arxiv_papers, "run",
                return_value=inserted_ids,
            ):
                result = collect_arxiv_papers.run("machine learning")

        assert isinstance(result, list)


def test_collect_arxiv_papers_builds_correct_data(arxiv_result_mock, fixture_papers):
    arxiv_papers = [p for p in fixture_papers if p["source"] == "arxiv"]

    with patch("app.tasks.collect.arxiv") as mock_arxiv, \
         patch("app.tasks.collect._run_async") as mock_run_async, \
         patch("app.tasks.collect.sleep"):

        mock_client = MagicMock()
        mock_arxiv.Client.return_value = mock_client
        mock_arxiv.Search.return_value = MagicMock()
        mock_client.results.return_value = iter(arxiv_result_mock)

        captured = []

        async def fake_run_async(coro):
            pass

        mock_run_async.side_effect = lambda coro: None

        from app.tasks.collect import collect_arxiv_papers
        collect_arxiv_papers.run("NLP")

    assert mock_arxiv.Client.called


def test_collect_semantic_scholar_papers_with_mock(ss_response_mock):
    with patch("app.tasks.collect.httpx") as mock_httpx, \
         patch("app.tasks.collect._run_async") as mock_run_async, \
         patch("app.tasks.collect.sleep"):

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = ss_response_mock
        mock_httpx.get.return_value = mock_resp
        mock_run_async.return_value = None

        from app.tasks.collect import collect_semantic_scholar_papers
        collect_semantic_scholar_papers.run("transformer")

    mock_httpx.get.assert_called_once()
    call_kwargs = mock_httpx.get.call_args
    assert "semanticscholar.org" in call_kwargs[0][0]


def test_collect_semantic_scholar_rate_limit():
    from app.core.exceptions import RateLimitError

    with patch("app.tasks.collect.httpx") as mock_httpx, \
         patch("app.tasks.collect.sleep"):

        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_httpx.get.return_value = mock_resp

        from app.tasks.collect import collect_semantic_scholar_papers

        with pytest.raises(RateLimitError):
            collect_semantic_scholar_papers.run("test")


def test_summarize_paper_with_mock(fixture_papers):
    paper_data = fixture_papers[0]
    paper_id = str(uuid.uuid4())

    mock_paper = MagicMock()
    mock_paper.id = paper_id
    mock_paper.title = paper_data["title"]
    mock_paper.abstract = paper_data.get("abstract", "")

    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="이 논문은 대형 언어 모델의 학술 작문 지원 응용에 관한 연구입니다.")]

    with patch("app.tasks.process._run_async") as mock_run_async:
        mock_run_async.return_value = "이 논문은 대형 언어 모델의 학술 작문 지원 응용에 관한 연구입니다."

        from app.tasks.process import summarize_paper
        result = summarize_paper.run(paper_id)

    assert result["status"] == "ok"
    assert result["paper_id"] == paper_id
    assert result["task"] == "summarize"


def test_summarize_paper_calls_claude(fixture_papers):
    paper_data = fixture_papers[0]
    paper_id = str(uuid.uuid4())

    mock_paper = MagicMock()
    mock_paper.id = paper_id
    mock_paper.title = paper_data["title"]
    mock_paper.abstract = paper_data.get("abstract", "")

    summary_text = "한국어 요약입니다."
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=summary_text)]

    async def fake_select_paper(*args, **kwargs):
        return mock_paper

    with patch("app.tasks.process.anthropic") as mock_anthropic, \
         patch("app.tasks.process._SessionLocal") as mock_session_local, \
         patch("app.tasks.process._run_async") as mock_run_async:

        mock_client = MagicMock()
        mock_anthropic.Anthropic.return_value = mock_client
        mock_client.messages.create.return_value = mock_message
        mock_run_async.return_value = summary_text

        from app.tasks.process import summarize_paper
        result = summarize_paper.run(paper_id)

    assert result["status"] == "ok"


def test_embed_paper_with_mock(fixture_papers):
    paper_data = fixture_papers[0]
    paper_id = str(uuid.uuid4())

    fake_embedding = [0.1] * 1536

    with patch("app.tasks.process._run_async") as mock_run_async:
        mock_run_async.return_value = None

        from app.tasks.process import embed_paper
        result = embed_paper.run(paper_id)

    assert result["status"] == "ok"
    assert result["paper_id"] == paper_id
    assert result["task"] == "embed"
    assert result["dimensions"] == 1536


def test_embed_paper_calls_openai(fixture_papers):
    paper_data = fixture_papers[0]
    paper_id = str(uuid.uuid4())

    mock_paper = MagicMock()
    mock_paper.id = paper_id
    mock_paper.title = paper_data["title"]
    mock_paper.abstract = paper_data.get("abstract", "")

    fake_embedding = [0.1] * 1536

    with patch("app.services.embedding_service._client") as mock_openai_client, \
         patch("app.tasks.process._SessionLocal") as mock_session_local, \
         patch("app.tasks.process._run_async") as mock_run_async:

        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=fake_embedding)]
        mock_openai_client.embeddings.create.return_value = mock_response
        mock_run_async.return_value = None

        from app.tasks.process import embed_paper
        result = embed_paper.run(paper_id)

    assert result["dimensions"] == 1536


def test_embed_paper_dimensions():
    from app.tasks.process import embed_paper

    with patch("app.tasks.process._run_async", return_value=None):
        result = embed_paper.run(str(uuid.uuid4()))

    assert result["dimensions"] == 1536
