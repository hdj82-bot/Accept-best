from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.models.database import get_db
from app.schemas.research_note import (
    NoteCreate,
    NoteListResponse,
    NoteRead,
    NoteToDraftQuestionsResponse,
    NoteToDraftRequest,
    NoteToDraftResponse,
    NoteUpdate,
)
from app.services.research_note_service import (
    create_note,
    delete_note,
    generate_pre_questions,
    get_note,
    list_notes,
    update_note,
)
from app.services.usage import check_quota, increment_usage
from app.services.user_service import get_user

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("", response_model=NoteRead)
async def add_note(
    req: NoteCreate,
    user_id: str = Depends(get_current_user),
):
    """연구 노트를 생성한다."""
    note = await create_note(req, user_id)
    return NoteRead.model_validate(note.__dict__)


@router.get("", response_model=NoteListResponse)
async def read_notes(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user),
):
    """연구 노트 목록을 조회한다."""
    notes, total = await list_notes(limit=limit, offset=offset)
    return NoteListResponse(
        notes=[NoteRead.model_validate(n.__dict__) for n in notes],
        total=total,
    )


@router.get("/{note_id}", response_model=NoteRead)
async def read_note(
    note_id: str,
    user_id: str = Depends(get_current_user),
):
    """연구 노트 상세 정보를 조회한다."""
    note = await get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteRead.model_validate(note.__dict__)


@router.put("/{note_id}", response_model=NoteRead)
async def edit_note(
    note_id: str,
    req: NoteUpdate,
    user_id: str = Depends(get_current_user),
):
    """연구 노트를 수정한다."""
    note = await update_note(note_id, req)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteRead.model_validate(note.__dict__)


@router.delete("/{note_id}")
async def remove_note(
    note_id: str,
    user_id: str = Depends(get_current_user),
):
    """연구 노트를 삭제한다."""
    note = await get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    await delete_note(note_id)
    return {"message": "삭제되었습니다"}


@router.post("/to-draft")
async def note_to_draft(
    req: NoteToDraftRequest,
    stage: str = Query(default="draft", regex="^(questions|draft)$"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """연구 노트를 초안으로 변환한다.

    소크라테스식 대화 정책 (academi.md "대화 정책"):
    - stage=questions: AI가 사전 질문 3~5개를 반환. 사용자는 답변 후 stage=draft 재호출.
    - stage=draft + user_answers: 답변을 컨텍스트로 받아 맞춤 초안 생성.
    - stage=draft + user_answers 없음: 일반 초안 생성 (정책상 답변은 선택).
    """
    note = await get_note(req.note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")

    if stage == "questions":
        questions = await generate_pre_questions(req.note_id, user_id, db)
        return NoteToDraftQuestionsResponse(note_id=req.note_id, questions=questions)

    user = await get_user(user_id)
    plan = user.plan if user else "free"
    await check_quota(user_id, "research_count", plan, db)

    try:
        from app.tasks import celery_app

        task = celery_app.send_task(
            "app.tasks.process.note_to_draft",
            args=[user_id, req.note_id, req.user_answers],
            queue="process",
        )
        task_id = task.id
    except Exception:
        task_id = "sync-execution"

    await increment_usage(user_id, "research_count", db)

    return NoteToDraftResponse(
        task_id=task_id,
        message="노트 → 초안 변환 태스크가 시작되었습니다.",
        note_id=req.note_id,
    )
