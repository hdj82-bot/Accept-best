# CLAUDE.md — Claude Code 세션 룰

## 이 파일의 역할

**대상**: Claude Code 세션 (자동으로 로드됨).
**범위**: 모델 정책, 프레임워크 주의사항, 코딩 컨벤션 — 즉 "어떻게 작업할지".

> 무엇을 만드는지 / 아키텍처 결정사항은 [academi.md](academi.md), 운영자/외부 방문자용은 [README.md](README.md), 비-Claude 에이전트(Cursor/Codex 등)용은 [AGENTS.md](AGENTS.md).

---

## 우선 읽기 순서 (세션 시작 시)

1. **이 파일** — 작업 룰 (지금 보고 있는 것)
2. **[academi.md](academi.md)** — 아키텍처 결정사항, DB 스키마, 코드 패턴
3. **변경 대상 코드** — 기존 구현을 본 뒤에 수정

---

<!-- BEGIN:model-policy -->
## 모델 정책

이 프로젝트의 모든 코드 생성·리뷰·리팩토링·디버깅은 **Claude Opus 4.7** (`claude-opus-4-7`, 1M context)로 진행한다.

- Sonnet/Haiku로 자동 다운그레이드 금지
- 비용 이슈로 Opus 4.6 이하로 내려야 할 때는 사용자에게 명시적으로 확인
- 세션 시작 시 `/model claude-opus-4-7`로 확인
- 1M context 활용을 전제로 한 번에 큰 컨텍스트 로딩 가능
<!-- END:model-policy -->

---

<!-- BEGIN:nextjs-agent-rules -->
## Next.js 16 — This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## 작업 원칙

1. **컨텍스트 선주입**: 새 태스크 착수 전 관련 기존 코드를 먼저 보여주고 요청
2. **계획 먼저**: 복잡한 태스크는 "코드 쓰지 말고 계획만 먼저 말해줘"
3. **테스트 동시 요청**: 기능 구현 시 pytest/RTL 테스트도 함께 작성
4. **막히면 분해**: 한 번에 하나씩. 동작 확인 후 다음 단계
5. **완료 기준 준수**: 기준 미달이면 다음 태스크 진행 금지
6. **새 의존성은 사용자 승인 후**: package.json / requirements.txt에 임의로 추가 금지
7. **DB 변경은 Alembic으로**: 마이그레이션 파일 없이 스키마 변경 금지
8. **임베딩 차원 고정**: `vector(1536)` 절대 변경 금지 (사유는 [academi.md](academi.md#임베딩-모델))
9. **베타 단계 절제**: 1인 베타 — 과도한 추상화/미사용 코드 추가 금지
