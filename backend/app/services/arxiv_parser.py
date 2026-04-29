"""arXiv Atom XML 파싱.

api/papers.py(_collect_from_arxiv)와 tasks/collect.py(_fetch_arxiv)가
같은 파싱 로직을 두 번 구현하던 것을 한 군데로 모은 모듈. 외부 I/O와
rate-limit 대기는 호출자 책임이고, 이 함수는 순수하게 XML → dict 리스트
변환만 한다.
"""

import xml.etree.ElementTree as ET
from datetime import datetime

NS = {"atom": "http://www.w3.org/2005/Atom"}


def parse_arxiv_xml(xml_content: str) -> list[dict]:
    """arXiv Atom 응답을 paper_service.save_paper 인자 형태의 dict 리스트로 변환."""
    root = ET.fromstring(xml_content)
    papers: list[dict] = []

    for entry in root.findall("atom:entry", NS):
        arxiv_id = (entry.findtext("atom:id", "", NS) or "").split("/abs/")[-1]
        if not arxiv_id:
            continue

        title = (entry.findtext("atom:title", "", NS) or "").strip().replace("\n", " ")
        abstract = (entry.findtext("atom:summary", "", NS) or "").strip().replace("\n", " ")

        authors = [
            a.findtext("atom:name", "", NS)
            for a in entry.findall("atom:author", NS)
        ]

        published_str = entry.findtext("atom:published", "", NS) or ""
        published_at = None
        if published_str:
            try:
                published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        pdf_url = None
        for link in entry.findall("atom:link", NS):
            if link.get("title") == "pdf":
                pdf_url = link.get("href")
                break

        categories = [
            c.get("term", "")
            for c in entry.findall("atom:category", NS)
            if c.get("term")
        ]

        papers.append({
            "title": title,
            "abstract": abstract,
            "author_ids": authors,
            "keywords": categories,
            "source": "arxiv",
            "source_id": arxiv_id,
            "pdf_url": pdf_url,
            "published_at": published_at,
        })

    return papers
