# academi.ai — Claude Code 컨텍스트

## 이 파일의 역할
Claude Code가 세션 시작 시 자동으로 읽는 파일입니다.
새 태스크 착수 전 반드시 이 파일을 먼저 확인하고 기존 구조에 맞게 코드를 작성하세요.

---

## 프로젝트 개요
- **서비스명**: academi.ai (논문집필 도우미 / Research Writing Assistant)
- **타깃**: 한국 대학교 교수·박사과정 연구자
- **개발 방식**: 1인 Claude Code 개발, 완성도 우선
- **현재 단계**: 런치 준비 완료 — 모든 Sprint 기능 구현 완료

---

## 확정된 아키텍처 결정사항 (절대 변경 금지)

### 임베딩 모델
- **모델**: `text-embedding-3-small` (OpenAI)
- **차원**: `vector(1536)` — 이미 DB 스키마에 반영됨
- **절대 변경 불가**: 바꾸면 전체 papers 테이블 재임베딩 필요

### 인증 구조
```
브라우저 → Next.js(next-auth) → Google/Kakao OAuth → JWT 발급
브라우저 → FastAPI → JWT 서명 검증만 (DB 조회 없음)
```
- next-auth와 FastAPI가 `NEXTAUTH_SECRET` 공유
- FastAPI는 `python-jose`로 HS256 검증만 수행
- next-auth encode/decode를 HS256 plain JWT로 오버라이드 (JWE 미사용)
- Google OAuth: Phase 1부터 활성
- Kakao OAuth: Phase 2부터 활성 (next-auth 프로바이더 설정 완료)

### Celery 큐 분리
- `collect` 큐: arXiv·SS API 수집 (느림, sleep(3) 필수) — 워커 2개
- `process` 큐: Claude API 요약·임베딩·설문 (빠름, 사용자 대기) — 워커 4개
- Docker Compose에서 워커 항상 분리 실행

---

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Frontend | Next.js (App Router) | 16.2.2 |
| React | React | 19.2.4 |
| Auth | next-auth | 5.0.0-beta.30 |
| Styling | Tailwind CSS | 4.x |
| E2E Test | Playwright | 1.52.0 |
| Backend | FastAPI | 0.111+ |
| ORM | SQLAlchemy (async) | 2.0+ |
| DB | PostgreSQL + pgvector | 16 |
| Cache/Queue | Redis | 7 |
| Task Queue | Celery | 5.3+ |
| AI | OpenAI + Anthropic Claude | - |
| Translation | DeepL API | - |
| Payment | PortOne (아임포트) | - |
| Monitoring | Sentry + Prometheus | - |
| Deploy | Docker Compose + GitHub Actions | - |

---

## 프로젝트 디렉토리 구조

```
project-root/
├── academi.md             ← 이 파일
├── DEPLOY.md              ← 배포 가이드
├── LAUNCH_CHECKLIST.md    ← 런치 체크리스트
├── docker-compose.yml     ← 개발용
├── docker-compose.prod.yml ← 프로덕션
├── docker-compose.override.yml ← 개발 오버라이드
├── Makefile
├── .env.example
├── .env.production.example
├── .github/workflows/
│   ├── ci.yml             ← 테스트 + 린트 + E2E
│   └── deploy.yml         ← 프로덕션 배포
├── infra/
│   ├── nginx/
│   │   ├── nginx.conf     ← 개발용
│   │   └── nginx.prod.conf ← 프로덕션 (SSL, HSTS, 보안헤더)
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alert.rules.yml
│   └── scripts/
│       ├── backup.sh      ← DB 백업 (14일 보관)
│       └── init-ssl.sh    ← Let's Encrypt 발급
├── backend/               ← FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/           ← 라우터 (15개)
│   │   ├── models/        ← SQLAlchemy 모델 (14개)
│   │   ├── schemas/       ← Pydantic 스키마
│   │   ├── services/      ← 비즈니스 로직 (18개)
│   │   ├── tasks/         ← Celery 태스크
│   │   │   ├── collect.py ← 논문 수집
│   │   │   ├── process.py ← 요약/임베딩/설문
│   │   │   ├── notify.py  ← 이메일 알림
│   │   │   ├── export.py  ← PDF/Markdown 내보내기
│   │   │   └── scheduled.py ← 정기 작업
│   │   └── core/
│   │       ├── auth.py    ← JWT 검증 + plan_required
│   │       ├── exceptions.py ← AppError 표준화
│   │       ├── config.py  ← 환경변수 (Pydantic Settings)
│   │       └── database.py ← DB 세션
│   ├── tests/             ← pytest (14개 모듈)
│   │   ├── conftest.py    ← 공통 fixture
│   │   └── fixtures/
│   │       └── papers.json ← 시드 데이터 10편
│   ├── alembic/           ← DB 마이그레이션 (0001~0007)
│   └── requirements.txt
└── frontend/              ← Next.js
    ├── app/               ← App Router (15개 라우트)
    ├── components/        ← UI 컴포넌트
    ├── lib/               ← API 클라이언트
    ├── auth.ts            ← next-auth 설정 (Google + Kakao)
    ├── e2e/               ← Playwright E2E (8개 spec)
    │   ├── auth.spec.ts
    │   ├── kakao-auth.spec.ts
    │   ├── pages.spec.ts
    │   ├── payment.spec.ts
    │   ├── payment-flow.spec.ts
    │   ├── research.spec.ts
    │   ├── search.spec.ts
    │   ├── translate.spec.ts
    │   └── helpers/
    │       └── mock-session.ts
    ├── playwright.config.ts
    └── package.json
```

---

## DB 테이블 (Alembic 0001~0007)

| 테이블 | 핵심 컬럼 | 비고 |
|--------|-----------|------|
| users | id, email, provider, plan, plan_expires_at | Google/Kakao OAuth |
| monthly_usage | user_id, year_month, research_count, ... | (user_id, year_month) UNIQUE |
| papers | id, embedding vector(1536), year, journal, (source, source_id) UNIQUE | 임베딩 차원 절대 변경 금지 |
| survey_questions | id, user_id, paper_id, original_q, adapted_q | 핵심 차별점 |
| paper_versions | id, user_id, content JSONB, save_type | auto: 최근 10개, manual: 무제한 |
| research_notes | id, user_id, content, created_at | 노트→초안 변환 |
| bookmarks | user_id, paper_id | (user_id, paper_id) UNIQUE |
| search_history | id, user_id, query | 검색 기록 |
| share_tokens | id, note_id, token, expires_at | 공유 링크 |
| payments | id, user_id, plan, amount, status, portone_payment_id | PortOne 연동 |
| collections | id, user_id, name, color | 컬렉션 관리 |
| collection_papers | collection_id, paper_id | (collection_id, paper_id) UNIQUE |
| paper_tags | id, user_id, paper_id, tag | 사용자 태깅 |
| references | id, user_id, title, authors, cite_key, doi | 참고문헌 관리 |

### Alembic 마이그레이션 체인
```
None → 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007
```

---

## API 엔드포인트 요약

| 라우터 | 경로 | 주요 기능 |
|--------|------|-----------|
| health | GET /health | 서비스 상태 |
| users | /api/users | 유저 CRUD, /me |
| papers | /api/papers | 검색, 수집, 상세 |
| research | /api/research | 연구 노트 CRUD |
| versions | /api/versions | 버전 히스토리 |
| survey | /api/survey | 설문문항 생성 |
| collections | /api/collections | 컬렉션 CRUD, 태그 |
| references | /api/references | 참고문헌 CRUD, BibTeX 내보내기 |
| bookmarks | /api/bookmarks | 북마크 토글 |
| billing | /api/billing | 플랜/구독 정보 |
| payment | /payment | 결제 prepare/complete/webhook |
| export | /api/export | PDF/Markdown 내보내기 |
| translate | /api/translate | 논문 번역 (DeepL) |
| share | /api/share | 공유 토큰 생성 |
| admin | /api/admin | 관리자 전용 |
| meta | /api/meta | 사용량 조회 |

---

## 핵심 코드 패턴

### 에러 처리 (app/core/exceptions.py)
```python
class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 500): ...

class RateLimitError(AppError): ...      # 429
class QuotaExceededError(AppError): ...  # 402
class ExternalAPIError(AppError): ...    # 502
```

### Celery 태스크 라우팅
```python
CELERY_TASK_ROUTES = {
    "app.tasks.collect.*": {"queue": "collect"},
    "app.tasks.process.*": {"queue": "process"},
}
```

### 플랜 접근 제어
```python
@router.post("/survey/generate")
@plan_required("basic")
async def generate_survey(user_id=Depends(get_current_user)): ...
```

---

## 환경변수 (필수)

| 변수 | 용도 | 프로덕션 필수 |
|------|------|:---:|
| NEXTAUTH_SECRET | JWT 서명 (FE+BE 공유) | O |
| GOOGLE_CLIENT_ID/SECRET | Google OAuth | O |
| KAKAO_CLIENT_ID/SECRET | Kakao OAuth | O |
| OPENAI_API_KEY | 임베딩 | O |
| ANTHROPIC_API_KEY | 요약/설문 | O |
| DEEPL_API_KEY | 번역 | O |
| SS_API_KEY | Semantic Scholar | O |
| DATABASE_URL | PostgreSQL | O |
| REDIS_URL | Redis (Celery broker + cache) | O |
| PORTONE_API_KEY/SECRET | 결제 | O |
| PORTONE_WEBHOOK_SECRET | 웹훅 검증 | O |
| SENTRY_DSN | 백엔드 모니터링 | O |
| NEXT_PUBLIC_SENTRY_DSN | 프론트엔드 모니터링 | O |
| NEXT_PUBLIC_API_URL | API 베이스 URL (빌드타임) | O |
| NEXT_PUBLIC_APP_URL | 앱 URL (메타데이터) | O |
| NEXT_PUBLIC_IMP_MERCHANT_ID | PortOne 가맹점 ID (빌드타임) | O |
| CORS_ORIGINS | CORS 허용 도메인 | O |
| DOMAIN | 프로덕션 도메인 | O |
| USE_FIXTURES | false (프로덕션) | O |

---

## 테스트

### 백엔드 (pytest)
- 14개 테스트 모듈, SQLite in-memory DB 사용
- `USE_FIXTURES=true` 시 mock/fixture 모드로 외부 API 호출 없음
- `conftest.py`에 공통 fixture: db_session, client, auth_headers, test_user

### 프론트엔드 E2E (Playwright)
- 8개 spec 파일 (auth, kakao-auth, pages, payment, payment-flow, research, search, translate)
- CI에서는 `npm run start` (프로덕션 빌드), 로컬에서는 `npm run dev`
- 모든 API 응답은 route mock으로 처리

### CI/CD (GitHub Actions)
- **ci.yml**: test-backend → test-frontend → e2e → lint
- **deploy.yml**: CI 통과 → Docker Hub push → SSH 배포 → health check → 실패 시 자동 롤백

---

## Claude Code 작업 원칙

1. **컨텍스트 선주입**: 새 태스크 착수 전 관련 기존 코드를 먼저 보여주고 요청
2. **계획 먼저**: 복잡한 태스크는 "코드 쓰지 말고 계획만 먼저 말해줘"
3. **테스트 동시 요청**: 기능 구현 시 pytest도 함께 요청
4. **막히면 분해**: 한 번에 하나씩. 동작 확인 후 다음 단계
5. **완료 기준 준수**: 기준 미달이면 다음 태스크 진행 금지
6. **환경변수 추가 시**: config.py Settings 클래스 + .env.example + .env.production.example 모두 업데이트
