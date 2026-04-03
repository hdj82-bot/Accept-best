# academi.ai 프로덕션 배포 가이드

## 아키텍처

```
Client ──▶ Nginx (443/SSL) ──▶ Frontend (Next.js :3000)
                              ├▶ Backend  (FastAPI :8000)
                              │   ├▶ PostgreSQL + pgvector
                              │   ├▶ Redis (broker + cache)
                              │   ├▶ Celery Workers (collect, process)
                              │   └▶ Celery Beat (스케줄러)
                              └▶ Certbot (SSL 자동 갱신)
```

## 사전 요구사항

| 항목 | 최소 사양 |
|------|----------|
| 서버 | Ubuntu 22.04+, 2vCPU, 4GB RAM, 40GB SSD |
| Docker | Docker Engine 24+, Docker Compose v2 |
| 도메인 | A 레코드가 서버 IP를 가리키고 있어야 함 |
| 포트 | 80, 443 인바운드 오픈 |

## 1단계: 서버 초기 설정

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 프로젝트 클론
sudo mkdir -p /srv/academi.ai
sudo chown $USER:$USER /srv/academi.ai
git clone https://github.com/hdj82-bot/academi.ai.git /srv/academi.ai
cd /srv/academi.ai
```

## 2단계: 환경변수 설정

```bash
cp .env.production.example .env
nano .env  # 실제 값 입력
```

**반드시 설정해야 하는 항목:**
- `DOMAIN` — 실제 도메인 (예: `academi.ai`)
- `POSTGRES_PASSWORD` — 강력한 비밀번호 (`openssl rand -base64 24`)
- `NEXTAUTH_SECRET` — JWT 서명키 (`openssl rand -base64 32`)
- `DATABASE_URL` — 위 비밀번호와 일치하도록 수정
- `DOCKERHUB_USERNAME` — Docker Hub 사용자명
- AI API 키들 — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` 등
- `USE_FIXTURES=false` — 반드시 false

## 3단계: SSL 인증서 발급

```bash
# nginx.prod.conf에서 DOMAIN 환경변수 치환
export DOMAIN=academi.ai
envsubst '${DOMAIN}' < infra/nginx/nginx.prod.conf > /tmp/nginx.prod.conf
cp /tmp/nginx.prod.conf infra/nginx/nginx.prod.conf

# SSL 초기 발급 (스테이징 테스트)
DOMAIN=academi.ai EMAIL=admin@academi.ai STAGING=1 ./infra/scripts/init-ssl.sh

# 정상 작동 확인 후 실제 발급
DOMAIN=academi.ai EMAIL=admin@academi.ai ./infra/scripts/init-ssl.sh
```

> 인증서는 certbot 컨테이너가 12시간마다 자동 갱신합니다.

## 4단계: 전체 서비스 시작

```bash
docker compose -f docker-compose.prod.yml up -d

# DB 마이그레이션
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 로그 확인
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

## 5단계: GitHub Actions 자동 배포 설정

GitHub 리포지토리 Settings > Secrets and variables > Actions에서 다음 시크릿 등록:

| Secret | 설명 | 예시 |
|--------|------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 사용자명 | `hdj82bot` |
| `DOCKERHUB_TOKEN` | Docker Hub 액세스 토큰 | (Hub > Settings > Security) |
| `DEPLOY_HOST` | 서버 IP/호스트명 | `123.456.789.0` |
| `DEPLOY_USER` | SSH 사용자 | `deploy` |
| `DEPLOY_SSH_KEY` | SSH 개인키 전체 내용 | `-----BEGIN OPENSSH...` |
| `NEXT_PUBLIC_API_URL` | 프론트엔드 API URL | `https://academi.ai/api` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (프론트) | `https://...@sentry.io/...` |

**배포 흐름:** `main` push → CI 통과 → Docker 이미지 빌드/푸시 → SSH 배포 → 헬스체크 → (실패 시 자동 롤백)

## DB 백업

```bash
# 즉시 백업
./infra/scripts/backup.sh

# crontab 등록 (매일 새벽 3시)
crontab -e
# 추가: 0 3 * * * cd /srv/academi.ai && ./infra/scripts/backup.sh >> /var/log/academi-backup.log 2>&1
```

백업 파일: `/srv/academi.ai/infra/scripts/backups/academi_YYYYMMDD_HHMMSS.sql.gz`
보존 기간: 14일 (자동 삭제)

### 백업 복원

```bash
gunzip -c infra/scripts/backups/academi_20260401_030000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U academi academi
```

## 모니터링

### Sentry
- `.env`에 `SENTRY_DSN` 설정 시 자동 활성화
- 백엔드: FastAPI + Starlette 통합
- 프론트엔드: Next.js client/server/edge 통합

### Prometheus
- 프로덕션 compose에 포함됨
- 메트릭: `research_requests_total`, `paper_search_total`, `export_jobs_total`, `active_users`
- Alert 규칙: [infra/prometheus/alert.rules.yml](infra/prometheus/alert.rules.yml)

### 로그 확인

```bash
# 전체 로그
docker compose -f docker-compose.prod.yml logs -f

# 특정 서비스
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f celery-collect
```

## 롤백

```bash
cd /srv/academi.ai

# 이전 태그로 롤백
export IMAGE_TAG=$(cat .current-tag.prev 2>/dev/null || git log --format=%H -2 | tail -1)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

GitHub Actions 배포 시 헬스체크 실패하면 자동 롤백됩니다.

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| nginx 502 Bad Gateway | `docker compose logs backend` 확인 → DB/Redis 연결 확인 |
| SSL 인증서 만료 | `docker compose run --rm certbot renew` → `docker compose exec nginx nginx -s reload` |
| Celery 작업 멈춤 | `docker compose restart celery-collect celery-process` |
| DB 연결 초과 | PostgreSQL `max_connections` 확인, 기본 100 |
| 메모리 부족 | `docker stats`로 확인 → `deploy.resources.limits.memory` 조정 |
