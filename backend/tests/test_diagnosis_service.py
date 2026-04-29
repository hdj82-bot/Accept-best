"""diagnosis_service 단위 테스트 — 소크라테스식 정책 반영 확인."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import diagnosis_service
from app.services.diagnosis_service import SYSTEM_PROMPT, diagnose_paper
from app.models.user import User


def test_system_prompt_mentions_socratic_policy():
    """프롬프트에 단정형 금지 + 질문형 마무리 지침이 있어야 한다."""
    p = SYSTEM_PROMPT
    # 정책 언급
    assert "소크라테스" in p or "대화 정책" in p
    # 신규 출력 필드
    assert "issues_with_questions" in p
    assert "observation" in p
    assert "question" in p
    # 단정형 금지 규칙이 명시돼야 한다
    assert "단정" in p


@pytest.mark.asyncio
async def test_diagnose_paper_persists_issues_with_questions(
    db_session: AsyncSession,
):
    user_id = str(uuid.uuid4())
    paper_id = str(uuid.uuid4())
    db_session.add(
        User(id=user_id, email=f"{user_id[:8]}@t.com", plan="free")
    )
    await db_session.flush()

    fake_payload = {
        "overall_score": 72,
        "sections": {
            "research_purpose": {"score": 80, "feedback": "ok"},
            "methodology": {"score": 70, "feedback": "ok"},
            "logic_structure": {"score": 65, "feedback": "ok"},
            "literature_use": {"score": 70, "feedback": "ok"},
            "conclusion": {"score": 75, "feedback": "ok"},
        },
        "recommendations": ["보완 1", "보완 2", "보완 3"],
        "issues_with_questions": [
            {
                "section": "logic_structure",
                "observation": "서론 RQ 와 결론의 연결이 명시되지 않았습니다.",
                "question": "이 둘을 잇는 의도하신 논리를 한 줄로 알려주실 수 있을까요?",
            },
        ],
    }

    fake_resp = SimpleNamespace(text=json.dumps(fake_payload, ensure_ascii=False))
    fake_client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(
                generate_content=AsyncMock(return_value=fake_resp)
            )
        )
    )

    with patch.object(
        diagnosis_service, "get_gemini_client", return_value=fake_client
    ):
        diag = await diagnose_paper(
            paper_id=paper_id,
            title="t",
            abstract="a",
            user_id=user_id,
            db=db_session,
        )

    assert diag.overall_score == 72
    assert diag.issues_with_questions is not None
    assert len(diag.issues_with_questions) == 1
    iwq = diag.issues_with_questions[0]
    assert iwq["section"] == "logic_structure"
    assert iwq["question"].endswith("?") or iwq["question"].endswith("?")


@pytest.mark.asyncio
async def test_diagnose_paper_tolerates_missing_issues_field(
    db_session: AsyncSession,
):
    """모델 응답이 issues_with_questions 를 누락해도 NULL 로 저장되며 실패하지 않음."""
    user_id = str(uuid.uuid4())
    db_session.add(
        User(id=user_id, email=f"{user_id[:8]}@t.com", plan="free")
    )
    await db_session.flush()

    fake_payload = {
        "overall_score": 60,
        "sections": {
            "research_purpose": {"score": 60, "feedback": "ok"},
            "methodology": {"score": 60, "feedback": "ok"},
            "logic_structure": {"score": 60, "feedback": "ok"},
            "literature_use": {"score": 60, "feedback": "ok"},
            "conclusion": {"score": 60, "feedback": "ok"},
        },
        "recommendations": ["a", "b", "c"],
        # issues_with_questions 의도적으로 누락
    }

    fake_resp = SimpleNamespace(text=json.dumps(fake_payload, ensure_ascii=False))
    fake_client = SimpleNamespace(
        aio=SimpleNamespace(
            models=SimpleNamespace(
                generate_content=AsyncMock(return_value=fake_resp)
            )
        )
    )

    with patch.object(
        diagnosis_service, "get_gemini_client", return_value=fake_client
    ):
        diag = await diagnose_paper(
            paper_id=str(uuid.uuid4()),
            title="t",
            abstract="a",
            user_id=user_id,
            db=db_session,
        )

    assert diag.issues_with_questions is None
