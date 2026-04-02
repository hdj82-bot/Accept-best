from fastapi import APIRouter

from app.tasks import celery_app
from app.tasks.export import export_research_markdown, export_research_pdf

router = APIRouter(prefix="/export")


@router.post("/markdown/{note_id}")
async def trigger_export_markdown(note_id: str, user_id: str = "anonymous"):
    task = export_research_markdown.delay(note_id, user_id)
    return {"task_id": task.id}


@router.post("/pdf/{note_id}")
async def trigger_export_pdf(note_id: str, user_id: str = "anonymous"):
    task = export_research_pdf.delay(note_id, user_id)
    return {"task_id": task.id}


@router.get("/status/{task_id}")
async def get_export_status(task_id: str):
    result = celery_app.AsyncResult(task_id)
    return {"status": result.state, "result": result.result}
