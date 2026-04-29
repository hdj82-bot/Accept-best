"""소크라테스식 대화 답변(연구자 회신) 저장·조회 헬퍼.

여러 서비스(summary / survey / diagnosis / note_to_draft)가 공유하는 generic
인터페이스. 각 서비스는 자기 서비스 이름과 도메인 식별자(context_id)만 넘기면
공통 user_dialog_answers 테이블에 누적된다.

본 PR 에서는 diagnosis_service / api/diagnosis.py 에서만 호출한다. 다른
서비스 통합은 후속 PR (academi.md 대화 정책 §데이터 활용 참조).
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_dialog_answer import UserDialogAnswer

# academi.md 대화 정책에서 명시한 4개 서비스. 호출 시점에 검증한다.
SERVICE_NAMES: frozenset[str] = frozenset(
    {"summary", "survey", "diagnosis", "note_to_draft"}
)


async def log_dialog_answer(
    *,
    user_id: str,
    service_name: str,
    context_id: str,
    question: str,
    answer: str,
    db: AsyncSession,
) -> UserDialogAnswer:
    """연구자 답변 1건을 누적 저장."""
    if service_name not in SERVICE_NAMES:
        raise ValueError(
            f"unknown service_name: {service_name!r}. "
            f"allowed: {sorted(SERVICE_NAMES)}"
        )
    entry = UserDialogAnswer(
        user_id=user_id,
        service_name=service_name,
        context_id=context_id,
        question=question,
        answer=answer,
    )
    db.add(entry)
    await db.flush()  # id 확보. commit 은 호출 측 / get_db 에 위임.
    return entry


async def list_dialog_answers(
    *,
    user_id: str,
    db: AsyncSession,
    service_name: str | None = None,
    context_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[UserDialogAnswer], int]:
    """본인 답변 조회. service_name / context_id 로 좁힐 수 있다."""
    base = select(UserDialogAnswer).where(UserDialogAnswer.user_id == user_id)
    count_q = (
        select(func.count())
        .select_from(UserDialogAnswer)
        .where(UserDialogAnswer.user_id == user_id)
    )
    if service_name is not None:
        if service_name not in SERVICE_NAMES:
            raise ValueError(f"unknown service_name: {service_name!r}")
        base = base.where(UserDialogAnswer.service_name == service_name)
        count_q = count_q.where(UserDialogAnswer.service_name == service_name)
    if context_id is not None:
        base = base.where(UserDialogAnswer.context_id == context_id)
        count_q = count_q.where(UserDialogAnswer.context_id == context_id)

    total = int((await db.execute(count_q)).scalar_one() or 0)
    rows = (
        (
            await db.execute(
                base.order_by(UserDialogAnswer.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return list(rows), total
