"""모델 정의가 올바른지 확인하는 유닛 테스트."""
from app.models.database import Base
from app.models.monthly_usage import MonthlyUsage
from app.models.paper import Paper
from app.models.paper_version import PaperVersion
from app.models.research_note import ResearchNote
from app.models.survey_question import SurveyQuestion
from app.models.user import User


def test_all_six_tables_registered():
    table_names = set(Base.metadata.tables.keys())
    expected = {
        "users",
        "monthly_usage",
        "papers",
        "survey_questions",
        "paper_versions",
        "research_notes",
    }
    assert expected.issubset(table_names), f"Missing: {expected - table_names}"


def test_paper_embedding_column_dimension():
    col = Paper.__table__.columns["embedding"]
    assert col.type.dim == 1536, "embedding 차원은 반드시 1536이어야 합니다"


def test_paper_source_unique_constraint():
    constraints = [
        c.name
        for c in Paper.__table__.constraints
        if hasattr(c, "name") and c.name
    ]
    assert "uq_paper_source" in constraints


def test_monthly_usage_unique_constraint():
    constraints = [
        c.name
        for c in MonthlyUsage.__table__.constraints
        if hasattr(c, "name") and c.name
    ]
    assert "uq_user_month" in constraints
