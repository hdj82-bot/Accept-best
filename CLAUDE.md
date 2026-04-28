<!-- BEGIN:model-policy -->
# Model Policy

이 프로젝트의 모든 코드 생성·리뷰·리팩토링·디버깅은 **Claude Opus 4.7** (`claude-opus-4-7`, 1M context)로 진행한다.

- Sonnet/Haiku로 자동 다운그레이드 금지
- 비용 이슈로 Opus 4.6 이하로 내려야 할 때는 사용자에게 명시적으로 확인
- 세션 시작 시 `/model claude-opus-4-7`로 확인
- 상세 프로젝트 컨텍스트는 `academi.md` 참고
<!-- END:model-policy -->

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
