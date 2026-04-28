# AGENTS.md — 비-Claude 에이전트용 룰

## 이 파일의 역할

**대상**: Claude Code 외 코딩 에이전트 (Cursor, GitHub Copilot, Codex, Aider, Gemini Code Assist 등).
**범위**: 이 레포에 작업할 때 따라야 할 최소 룰.

> Claude Code 세션의 1차 출처는 [CLAUDE.md](CLAUDE.md)입니다. 이 문서는 그 핵심을 비-Claude 에이전트가 이해할 수 있는 형태로 압축한 버전입니다. 충돌하면 CLAUDE.md를 따르세요.

---

## 우선 읽을 파일

1. [academi.md](academi.md) — 프로젝트 전체 컨텍스트(아키텍처/DB 스키마/코드 패턴)
2. [CLAUDE.md](CLAUDE.md) — Claude Code용 세부 룰 (모델 정책, Next.js 16 경고, 작업 원칙)
3. 작업 영역 코드 — 수정 전 반드시 기존 구현 확인

---

## 사용 모델

이 프로젝트의 코드 작업은 **Claude Opus 4.7** (`claude-opus-4-7`, 1M context)을 권장합니다. 자세한 정책은 [CLAUDE.md의 모델 정책](CLAUDE.md#모델-정책) 참고.

비-Anthropic 모델(GPT/Gemini 등)을 쓰는 에이전트로 동등 수준의 작업이 필요할 때는 **사용자 승인 필수**. 임의 사용 금지.

---

## 작업 원칙 (요약)

- 새 의존성 추가 전 사용자 승인 필요
- 기능 구현 시 pytest/RTL 테스트 동반
- 임베딩 차원 `vector(1536)` 변경 금지 (Phase 1)
- DB 스키마 변경은 Alembic 마이그레이션 파일로만
- Next.js 16의 변경된 API에 주의 — 학습 데이터의 구버전과 다름. `node_modules/next/dist/docs/` 우선 참조
- 1인 베타 단계 — 과도한 추상화·미사용 코드 추가 금지

전체 룰은 [CLAUDE.md](CLAUDE.md#작업-원칙)를 따르세요.
