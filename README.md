# 논문집필 도우미 (academi.ai)

AI 기반 논문 수집·설문·버전관리·건강검진 — 한국 연구자를 위한 올인원 플랫폼.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 백엔드 | FastAPI 0.110 · Python 3.12 · SQLAlchemy 2 (async) |
| 프런트엔드 | Next.js 14 App Router · TypeScript · Tailwind CSS |
| 데이터베이스 | PostgreSQL 16 + pgvector (임베딩 벡터 검색) |
| 비동기 작업 | Celery 5 · Redis 7 (브로커 + 결과 백엔드) |
| 인프라 | Docker Compose · nginx (리버스 프록시 + rate limit) |
| AI | OpenAI text-embedding-3-small · Anthropic Claude Haiku |
| 결제 | PortOne (아임포트) |

## 빠른 시작 (로컬 개발)

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 필수 값 입력 (최소: NEXTAUTH_SECRET, GOOGLE_CLIENT_*)

# 2. 서비스 시작 (hot reload 포함)
make dev

# 3. DB 마이그레이션
make migrate

# 4. (선택) 시드 데이터 삽입
make seed
```

브라우저에서 http://localhost:3000 접속.
API 문서: http://localhost:8000/docs

## 환경변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `NEXTAUTH_SECRET` | next-auth JWT 서명 키 | ✓ |
| `NEXTAUTH_URL` | 앱 URL (프로덕션: https://your-domain.com) | ✓ |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | ✓ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 | ✓ |
| `OPENAI_API_KEY` | 임베딩 생성용 | ✓ |
| `ANTHROPIC_API_KEY` | Claude 요약·건강검진·리랭킹 | ✓ |
| `GEMINI_API_KEY` | (선택) Gemini 백업 | |
| `SS_API_KEY` | Semantic Scholar API | |
| `DATABASE_URL` | PostgreSQL asyncpg URL | ✓ |
| `REDIS_URL` | Redis 연결 URL | ✓ |
| `AWS_ACCESS_KEY_ID` | S3 PDF 저장 | |
| `AWS_SECRET_ACCESS_KEY` | S3 PDF 저장 | |
| `AWS_S3_BUCKET` | S3 버킷 이름 | |
| `PORTONE_API_KEY` | PortOne 결제 API 키 | |
| `PORTONE_API_SECRET` | PortOne 시크릿 | |
| `PORTONE_WEBHOOK_SECRET` | 웹훅 서명 검증 키 | |
| `SENTRY_DSN` | 에러 모니터링 | |
| `USE_FIXTURES` | `true` 시 외부 API 목업 (개발용) | |

## Makefile 명령어

```bash
make dev        # 개발 서버 시작 (hot reload + Flower + Prometheus)
make up         # 프로덕션 모드로 시작
make down       # 서비스 중지
make migrate    # alembic upgrade head
make test       # pytest 전체 실행
make seed       # 시드 데이터 삽입
make format     # ruff 포맷 + lint --fix
make logs       # 전체 로그 (make logs s=backend 으로 특정 서비스)
make shell-be   # 백엔드 컨테이너 bash
make shell-db   # PostgreSQL psql
```

## 배포 (프로덕션)

### 사전 준비

1. `.env`에 프로덕션 값 설정 (특히 `NEXTAUTH_URL=https://your-domain.com`)
2. SSL 인증서 준비:
   ```
   infra/nginx/ssl/cert.pem
   infra/nginx/ssl/key.pem
   ```
3. Docker Hub 이미지 푸시는 GitHub Actions CI/CD가 자동 처리 (`main` 브랜치 push 시)

### 배포 실행

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### GitHub Actions 시크릿 (`.github/workflows/deploy.yml` 참고)

| 시크릿 | 설명 |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub 사용자명 |
| `DOCKERHUB_TOKEN` | Docker Hub 액세스 토큰 |
| `DEPLOY_HOST` | 배포 서버 IP/도메인 |
| `DEPLOY_USER` | SSH 사용자 |
| `DEPLOY_KEY` | SSH 프라이빗 키 |

## 테스트

```bash
make test
# 또는
docker compose exec backend pytest tests/ -v --tb=short
```

현재 테스트 현황: **82개** (10개 파일)

## 프로젝트 구조

```
academi.ai/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI 라우터 (14개)
│   │   ├── models/       # SQLAlchemy ORM 모델
│   │   ├── services/     # 비즈니스 로직
│   │   ├── tasks/        # Celery 태스크 (collect / process)
│   │   └── core/         # 설정, 인증, DB 연결
│   ├── alembic/          # DB 마이그레이션 (0001~0007)
│   └── tests/            # pytest (82개)
├── frontend/
│   ├── app/              # Next.js App Router 페이지 (14개)
│   ├── components/       # 공유 컴포넌트 (15개)
│   └── e2e/              # Playwright E2E 테스트
├── infra/
│   ├── nginx/            # nginx 설정 + SSL
│   └── prometheus/       # Prometheus 스크레이프 설정
├── docker-compose.yml
├── docker-compose.override.yml  # 개발 (hot reload + 모니터링)
├── docker-compose.prod.yml      # 프로덕션
└── Makefile
```
