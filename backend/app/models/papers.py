import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from pgvector.sqlalchemy import Vector

from .base import Base


class Paper(Base):
    __tablename__ = "papers"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_papers_source_source_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False)        # "arxiv" | "semantic_scholar"
    source_id = Column(String(255), nullable=False)    # external paper ID
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    authors = Column(ARRAY(Text), nullable=True)       # author names
    author_ids = Column(ARRAY(Text), nullable=True)    # Semantic Scholar author IDs
    keywords = Column(ARRAY(Text), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    doi = Column(String(255), nullable=True)
    url = Column(Text, nullable=True)
    pdf_url = Column(Text, nullable=True)
    citation_count = Column(Integer, nullable=True, default=0)
    summary = Column(Text, nullable=True)              # Claude-generated summary
    embedding = Column(Vector(1536), nullable=True)    # text-embedding-3-small
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
