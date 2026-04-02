from app.tasks import celery_app


def test_celery_task_routes():
    routes = celery_app.conf.task_routes
    assert "app.tasks.collect.*" in routes
    assert routes["app.tasks.collect.*"]["queue"] == "collect"
    assert "app.tasks.process.*" in routes
    assert routes["app.tasks.process.*"]["queue"] == "process"


def test_collect_task_registered():
    from app.tasks.collect import collect_papers

    assert collect_papers.name == "app.tasks.collect.collect_papers"
    assert collect_papers.queue == "collect"


def test_process_tasks_registered():
    from app.tasks.process import generate_embedding, summarize_paper

    assert summarize_paper.name == "app.tasks.process.summarize_paper"
    assert generate_embedding.name == "app.tasks.process.generate_embedding"
