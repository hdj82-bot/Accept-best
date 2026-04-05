# 기여 가이드 (CONTRIBUTING)

`academi.ai` 에 기여해주셔서 감사합니다. 이 문서는 효율적인 협업을 위한 규칙과 절차를 안내합니다.

## 행동 강령 (Code of Conduct)

- 서로 존중하는 언어를 사용합니다.
- 정치/종교/외모 관련 농담이나 인신 공격을 하지 않습니다.
- 위반 사례는 maintainers@academi.ai 로 비공개 제보해주세요.

## 기여 방법 개요

1. **이슈 먼저** — 중복·의도 확인을 위해 작업 전 이슈를 열어 논의합니다.
2. **포크 & 브랜치** — `main` 에서 브랜치 분기, 아래 네이밍 규칙을 따르세요.
3. **커밋** — [Conventional Commits](https://www.conventionalcommits.org/) 스타일.
4. **테스트 추가** — 기능/버그 수정에는 반드시 테스트를 포함합니다.
5. **PR 생성** — 템플릿을 채우고 리뷰어를 지정합니다.

---

## 브랜치 네이밍

```
feat/<짧은-설명>        # 새 기능
fix/<짧은-설명>         # 버그 수정
chore/<짧은-설명>       # 빌드/설정/문서
refactor/<짧은-설명>    # 동작 변경 없는 리팩토링
test/<짧은-설명>        # 테스트만 추가/수정
docs/<짧은-설명>        # 문서만 수정
```

예: `feat/collection-tags`, `fix/export-pdf-korean-font`.

## 커밋 메시지

```
<type>(<scope>): <subject>

<body (선택)>

<footer (선택: BREAKING CHANGE, Closes #123)>
```

- **type**: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `style`, `ci`
- **scope** (선택): `backend`, `frontend`, `infra`, `auth`, `billing` 등
- 제목은 **50자 이내**, 명령형 현재시제 (`Add`, `Fix`).
- 본문은 **왜** 변경했는지 설명 (무엇은 diff로 보입니다).

예:
```
feat(billing): add monthly→yearly plan toggle

연 결제 시 20% 할인을 적용하고 PortOne amount를 12× 가격으로 전달한다.
연구자 설문에서 요청된 기능이라 우선순위를 높여 구현했다.

Closes #124
```

## 개발 환경 세팅

```bash
git clone https://github.com/hdj82-bot/academi.ai.git
cd academi.ai
cp .env.example .env   # 필수값 입력
make dev               # hot reload 포함 전체 스택 기동
make migrate
make seed              # (선택) 시드 데이터
```

- Frontend: `cd frontend && npm install && npm run dev`
- Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`

## 코딩 스타일

### Frontend (TypeScript / Next.js)

- Next.js **App Router** 컨벤션 준수 (서버/클라이언트 경계 구분).
- `frontend/AGENTS.md` 의 경고를 반드시 읽고 **`node_modules/next/dist/docs/`** 의 가이드를 확인한 뒤 API 사용.
- Tailwind 클래스는 `prettier-plugin-tailwindcss` 순서를 따르세요.
- ESLint: `npm run lint` 통과 필수.

### Backend (Python / FastAPI)

- `ruff format && ruff check --fix` (또는 `make format`).
- Async/await 일관성 유지 — blocking I/O는 `asyncio.to_thread` 또는 Celery 태스크로.
- Pydantic v2 모델 사용, `model_config` 로 alias/validators 정의.

### 공통

- 공개 함수·클래스에 **docstring**.
- 사용자 메시지는 **한국어**, 내부 주석/로그는 영어 권장.
- 타입 힌트 100% — `mypy`/`tsc --noEmit` 통과.

## 테스트

PR 병합 조건:

- **Backend**: `make test` 전체 통과.
- **Frontend**:
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e` (영향 받는 스펙만 실행 가능)

신규 엔드포인트에는 `backend/tests/` 에 통합 테스트를 추가합니다. UI 변경은 최소 1개의 Playwright 스펙을 추가하세요.

## 보안 관련 기여

보안 취약점은 **공개 이슈를 만들지 말고** security@academi.ai 로 제보해주세요. 48시간 내 1차 응답을 드립니다.

인증/결제/권한 관련 PR은 [보안 감사 체크리스트](./docs/security-audit.md) 항목을 체크한 결과를 PR 본문에 첨부해주세요.

## PR 리뷰 기준

리뷰어는 다음을 확인합니다.

1. **정확성** — 테스트가 커버하는 행동이 요구사항과 일치.
2. **가독성** — 이름, 구조, 주석.
3. **안전성** — 입력 검증, 권한 체크, 에러 처리.
4. **성능** — N+1 쿼리, 불필요한 리렌더, 과도한 번들 증가.
5. **문서화** — API/설정 변경 시 `docs/` 및 README 갱신.

## 라이선스

PR을 제출하시면 본 프로젝트의 MIT 라이선스 하에 기여하는 것에 동의하는 것으로 간주합니다.

---

감사합니다! 궁금한 점은 `#contributors` 디스커션 채널이나 이슈로 남겨주세요.
