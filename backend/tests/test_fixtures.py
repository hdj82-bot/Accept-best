import pytest


def test_paper_fixtures_count(paper_fixtures):
    assert len(paper_fixtures) == 10


def test_paper_fixtures_have_required_fields(paper_fixtures):
    required = {"title", "abstract", "source", "source_id"}
    for paper in paper_fixtures:
        assert required.issubset(paper.keys()), f"Missing fields in: {paper['title']}"


@pytest.mark.asyncio
async def test_seeded_papers_in_db(seeded_papers):
    assert len(seeded_papers) == 10
    for paper in seeded_papers:
        assert paper.id is not None
        assert paper.title
