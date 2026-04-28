# AGENTS.md

이 레포에서 코딩 에이전트(Claude Code, Cursor, Codex 등)가 작업할 때 따라야 할 규칙입니다.

## 사용 모델 — 고정

이 프로젝트의 모든 작업은 **Claude Opus 4.7** (`claude-opus-4-7`, 1M context)로 수행한다.

- 다른 모델(Sonnet/Haiku/GPT/Gemini 등)로의 자동 전환 금지
- 비 Anthropic 모델로 동등 작업이 필요할 때는 사용자 승인 필수
- 1M context 활용을 전제로 한 번에 큰 컨텍스트 로딩 가능

## 우선 읽을 파일

1. `academi.md` — 프로젝트 전체 컨텍스트(아키텍처/스프린트/DB 스키마)
2. `CLAUDE.md` — 모델 정책 + Next.js 경고
3. 작업 영역 코드 (수정 전 반드시 기존 구현 확인)

## 작업 원칙

- 새 의존성 추가 전 사용자 승인 필요
- 기능 구현 시 pytest/RTL 테스트 동반
- 임베딩 차원 `vector(1536)` 변경 금지 (Phase 1 동안)
- DB 스키마 변경은 alembic 마이그레이션 파일로만
- 1인 베타 단계 — 과도한 추상화/미사용 코드 추가 금지
