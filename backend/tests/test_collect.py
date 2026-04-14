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
