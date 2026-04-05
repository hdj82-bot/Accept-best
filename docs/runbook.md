# academi.ai — 프로덕션 Runbook

> 운영 담당자가 배포/장애 대응 시 참조하는 문서. 모든 명령은 배포 서버(`/srv/academi.ai`) 기준.

---

## 1. 아키텍처 요약

```
 Internet
    │
    ▼
  nginx (443, TLS 종단)
    ├── / → frontend (Next.js :3000)
    └── /api/ → backend (FastAPI :8000)
                 ├── db (Postgres + pgvector)
                 ├── redis (브로커 + 캐시)
                 ├── celery-collect (Q: collect)
                 ├── celery-process (Q: process)
                 └── celery-beat (스케줄러)

 관측성: prometheus → grafana, loki ← promtail, sentry (외부)
 백업:   pg-backup 컨테이너 (cron) → S3
```

## 2. 긴급 연락처 / 대시보드

| 리소스 | URL / 경로 |
|---|---|
| Grafana | https://grafana.internal/ |
| Sentry (백엔드) | https://sentry.io/organizations/academi/projects/academi-backend/ |
| Sentry (프론트) | https://sentry.io/organizations/academi/projects/academi-frontend/ |
| Uptime | (외부 업체) |
| 서버 SSH | `ssh deploy@prod.academi.example` |

---

## 3. 일상 배포

### 자동 (main 머지 시)
1. PR이 main에 머지되면 `.github/workflows/deploy.yml`이 실행
2. Docker 이미지 빌드 → Docker Hub 푸시 → SSH로 서버에서 `compose pull && up -d`
3. Alembic 마이그레이션 자동 실행

### 수동
```bash
ssh deploy@prod.academi.example
cd /srv/academi.ai
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
docker compose -f docker-compose.prod.yml ps
```

### 배포 전 체크리스트
- [ ] CI 그린 (test-backend / test-frontend / e2e / lint)
- [ ] Alembic 마이그레이션이 있으면 롤백 경로 확인 (`alembic downgrade -1` 가능?)
- [ ] 환경변수 추가가 필요하면 **`.env`에 먼저 반영**
- [ ] 운영 시간 외 배포 권장 (KST 23:00~08:00)

### 배포 후 체크리스트 (5분)
- [ ] `curl https://your-domain/health/live` → 200
- [ ] 내부망에서 `curl http://backend:8000/health/deep` → 모든 check OK
- [ ] Grafana **API Overview** 대시보드 — 5xx 0%, p95 정상
- [ ] Sentry — 새로운 이슈 급증 없음
- [ ] 2-3개 핵심 유저 플로우 수동 검증

---

## 4. 롤백

### 애플리케이션 롤백 (빠름)
```bash
cd /srv/academi.ai
# Docker Hub에서 이전 커밋 태그로 되돌림
export PREV_SHA=<이전 정상 커밋 해시>
docker compose -f docker-compose.prod.yml pull
docker tag $DOCKERHUB_USERNAME/academi-backend:$PREV_SHA $DOCKERHUB_USERNAME/academi-backend:latest
docker tag $DOCKERHUB_USERNAME/academi-frontend:$PREV_SHA $DOCKERHUB_USERNAME/academi-frontend:latest
docker compose -f docker-compose.prod.yml up -d
```

### DB 마이그레이션 롤백
```bash
docker compose -f docker-compose.prod.yml exec -T backend alembic downgrade -1
```
> 주의: 컬럼 DROP 포함된 마이그레이션은 되돌릴 수 없음. **배포 전 확인 필수.**

### DB 복구 (최후수단 — 데이터 손실)
백업 복구는 §7 참조. RTO 목표: **30분**, RPO: **24시간** (일일 백업 기준).

---

## 5. 장애 대응 플레이북

### 5.1 5xx 급증 (>5% for 5m)
Grafana 알림 트리거: `academi-5xx-high`
1. Grafana **API Overview** → 어느 라우트에서 발생하는지 확인 (`handler` 차원)
2. Sentry 최근 이슈 → 스택트레이스 확인
3. 로그: Grafana Explore → `{service="backend", level="error"}` 최근 10분
4. DB 원인 가능성:
   ```bash
   docker compose -f docker-compose.prod.yml exec db \
     psql -U academi -c "SELECT pid, state, wait_event, query FROM pg_stat_activity WHERE state != 'idle';"
   ```
5. 원인이 명확하면 hotfix, 아니면 **롤백** (§4)

### 5.2 p95 레이턴시 > 2s
1. **Infra & DB** 대시보드 → DB 연결수, commit/rollback 비율
2. Celery 큐 backlog 확인 → backlog가 쌓이면 동기 경로가 느려짐
3. 느린 쿼리 확인:
   ```bash
   docker compose exec db psql -U academi -c \
     "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
   ```
4. 임시 완화: `docker compose -f docker-compose.prod.yml up -d --scale backend=3`

### 5.3 Celery 큐 적체 (>500)
Grafana 알림: `academi-queue-backlog`
```bash
# 워커 스케일 아웃
docker compose -f docker-compose.prod.yml up -d --scale celery-process=4
# 큐 상태 확인
docker compose exec redis redis-cli LLEN process
# Dead letter / 재시도 무한루프 확인
docker compose logs celery-process --tail=200 | grep -i retry
```

### 5.4 DB 연결 포화 (>85%)
1. 연결 풀 누수 의심 → 앱 재시작: `docker compose restart backend`
2. 유휴 연결 정리:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < now() - interval '10 minutes';
   ```
3. 근본 원인: SQLAlchemy `pool_size` 조정 (앱 설정)

### 5.5 디스크 풀
```bash
df -h
docker system df
# 정리
docker image prune -af --filter "until=168h"
docker volume prune -f  # 주의: 사용 중이지 않은 볼륨만
# DB WAL 누적 시
docker compose exec db psql -U academi -c "CHECKPOINT;"
```

### 5.6 완전 다운
```bash
# 빠른 재시작
docker compose -f docker-compose.prod.yml restart
# 그래도 안 되면
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
# nginx만 죽었을 때
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 6. TLS 인증서 갱신
Let's Encrypt 자동 갱신이 기본. 수동 갱신:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 7. 백업 & 복구

### 백업 확인
```bash
aws s3 ls s3://$S3_BUCKET/pg-backups/ --region ap-northeast-2 | tail -20
# pg-backup 컨테이너 로그
docker compose -f docker-compose.prod.yml logs pg-backup --tail=50
```

### 복구 (Dry-run → 실행)
```bash
# 가장 최근 백업 확인만
docker compose -f docker-compose.prod.yml run --rm pg-backup \
  /opt/backup/pg_restore.sh latest

# 실제 복구 (기존 DB 덮어씀!)
docker compose -f docker-compose.prod.yml run --rm \
  -e CONFIRM=yes pg-backup \
  /opt/backup/pg_restore.sh latest
```

### 월 1회 복구 드릴
Staging 환경에 `latest` 백업을 복구해서 앱이 정상 동작하는지 확인.

---

## 8. 시크릿 로테이션
```bash
# DB 비밀번호
docker compose exec db psql -U postgres -c "ALTER USER academi WITH PASSWORD 'NEW_PASSWORD';"
# .env의 POSTGRES_PASSWORD 업데이트 → 재배포

# NEXTAUTH_SECRET — 바꾸면 모든 세션 무효화
openssl rand -hex 32
# .env 업데이트 → frontend 재시작
```

모든 시크릿은 **서버의 .env + GitHub Secrets**에만 존재. 절대 git에 커밋 금지.

---

## 9. 첫 서버 부트스트랩 (신규 서버)
```bash
# 1. Docker, Compose plugin 설치
curl -fsSL https://get.docker.com | sh
# 2. 디렉터리
sudo mkdir -p /srv/academi.ai && sudo chown $USER /srv/academi.ai
cd /srv/academi.ai
git clone https://github.com/hdj82-bot/academi.ai.git .
# 3. .env 작성 (.env.example 참고)
cp .env.example .env && vi .env
# 4. TLS 발급 (최초 1회)
./infra/nginx/init-letsencrypt.sh
# 5. 기동
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
```

---

## 10. SLO / SLI 목표

| 지표 | 목표 | 측정 |
|---|---|---|
| 가용성 | 99.5%/월 | uptime 체크 |
| p95 API 레이턴시 | < 800ms | `http_request_duration_seconds` |
| 에러율 | < 1% | 5xx / total |
| 백업 신선도 | < 25h | S3 최신 객체 시각 |
