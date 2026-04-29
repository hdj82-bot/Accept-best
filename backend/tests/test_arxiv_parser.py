"""arxiv_parser.parse_arxiv_xml 단위 테스트.

api/papers.py와 tasks/collect.py 양쪽이 동일 파싱 로직을 쓰던 것을
한 모듈로 통합했으므로, 그 모듈의 동작을 직접 검증한다.
"""

from datetime import datetime, timezone

from app.services.arxiv_parser import parse_arxiv_xml


SINGLE_ENTRY_XML = """<?xml version="1.0" encoding="UTF-8"?>
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


MULTI_ENTRY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>First Paper</title>
    <summary>First abstract.</summary>
    <author><name>Alice</name></author>
    <published>2024-01-15T00:00:00Z</published>
    <link title="pdf" href="http://arxiv.org/pdf/2401.00001v1" rel="related"/>
    <category term="cs.LG"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.00002v1</id>
    <title>Second Paper</title>
    <summary>Second abstract.</summary>
    <author><name>Bob</name></author>
    <published>2024-02-15T00:00:00Z</published>
    <category term="cs.AI"/>
  </entry>
</feed>"""


def test_single_entry_extracts_all_fields():
    papers = parse_arxiv_xml(SINGLE_ENTRY_XML)
    assert len(papers) == 1
    p = papers[0]
    assert p["source"] == "arxiv"
    assert p["source_id"] == "2401.00001v1"
    assert p["title"] == "Test Paper on Machine Learning"
    assert p["abstract"] == "This is a test abstract about ML."
    assert p["author_ids"] == ["Alice Kim", "Bob Lee"]
    assert p["keywords"] == ["cs.LG", "cs.AI"]
    assert p["pdf_url"] == "http://arxiv.org/pdf/2401.00001v1"
    assert p["published_at"] == datetime(2024, 1, 15, tzinfo=timezone.utc)


def test_missing_pdf_link_returns_none():
    """pdf link가 없는 entry는 pdf_url=None — 채움 로직이 NULL-safe해야 함."""
    papers = parse_arxiv_xml(MULTI_ENTRY_XML)
    assert len(papers) == 2
    assert papers[0]["pdf_url"] == "http://arxiv.org/pdf/2401.00001v1"
    assert papers[1]["pdf_url"] is None


def test_dict_keys_match_save_paper_signature():
    """반환 dict가 paper_service.save_paper(**p) 호출에 그대로 쓰일 수 있어야 함."""
    papers = parse_arxiv_xml(SINGLE_ENTRY_XML)
    expected = {
        "title", "abstract", "author_ids", "keywords",
        "source", "source_id", "pdf_url", "published_at",
    }
    assert set(papers[0].keys()) == expected


def test_empty_feed_returns_empty_list():
    empty_xml = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
    assert parse_arxiv_xml(empty_xml) == []


def test_entry_without_id_is_skipped():
    """id가 없는 entry는 source_id를 만들 수 없으므로 건너뛴다."""
    xml = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>No id</title>
    <summary>abstract</summary>
  </entry>
</feed>"""
    assert parse_arxiv_xml(xml) == []
