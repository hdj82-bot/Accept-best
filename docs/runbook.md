# academi.ai — 프로덕션 Runbook

> 운영 담당자가 배포/장애 대응 시 참조하는 문서.
> 모든 명령은 배포 서버 `/srv/academi.ai` 기준.

---

## 1. 아키텍처 요약

```
Internet
   |
   v
 nginx (80->443, TLS)
   |-- /       -> frontend (Next.js :3000, standalone)
   `-- /api/   -> backend  (FastAPI :8000)
                    |-- db    (Postgres 16 + pgvector)
                    |-- redis (broker + cache, AOF)
                    |-- celery-collect  (Q: collect, concurrency 2)
                    |-- celery-process  (Q: process, concurrency 4)
                    `-- celery-beat     (scheduler)

 cert:    certbot (12h auto renew)
 metrics: prometheus -> grafana
 logs:    stdout -> promtail -> loki -> grafana
 alerts:  grafana unified alerting
 errors:  sentry (backend + frontend)
```

### 리소스 제한

| 서비스 | 메모리 |
|---|---|
| db | 512m |
| redis | 192m (maxmemory 128mb) |
| backend | 512m |
| celery-collect | 256m |
| celery-process | 256m |
| celery-beat | 128m |
| frontend | 256m |
| nginx | 128m |
| prometheus | 256m |
| grafana | 256m |
| loki | 256m |
| promtail | 128m |

---

## 2. 대시보드

| 리소스 | URL |
|---|---|
| Grafana | http://127.0.0.1:3001 (localhost only) |
| Prometheus | http://127.0.0.1:9090 |
| Sentry (backend) | sentry.io -> academi-backend |
| Sentry (frontend) | sentry.io -> academi-frontend |

### Grafana 알림 규칙

| UID | 조건 | 심각도 |
|---|---|---|
| academi-5xx-high | 5xx > 5% (5m) | critical |
| academi-api-latency | p95 > 2s (10m) | warning |
| academi-db-conn | conn > 85% max (5m) | warning |
| academi-queue-backlog | queue > 500 (10m) | warning |
| academi-celery-failure-rate | task fail > 10% (5m) | critical |
| academi-celery-task-latency | task p95 > 60s (5m) | warning |
| academi-redis-memory | mem > 80% max (5m) | warning |
| academi-redis-connection-spike | clients > 200 (5m) | warning |
| academi-container-restart | 3+ restarts/15m | critical |

---

## 3. 배포

### 자동 (main merge)
`.github/workflows/deploy.yml` -> Docker build -> push -> SSH deploy -> alembic migrate

### 수동
```bash
cd /srv/academi.ai
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
docker compose -f docker-compose.prod.yml ps
```

### 배포 전 체크리스트
- [ ] CI 그린
- [ ] alembic downgrade -1 가능 확인
- [ ] .env 새 변수 반영
- [ ] 운영시간 외 배포 권장

### 배포 후 검증 (5분)
- [ ] curl -fsS https://domain/health -> 200
- [ ] Grafana -> 5xx 없음, p95 정상
- [ ] Sentry -> 새 이슈 없음

---

## 4. 롤백

### 앱 롤백
```bash
export IMAGE_TAG=<이전-정상-SHA>
docker compose -f docker-compose.prod.yml up -d
```

### DB 롤백
```bash
docker compose -f docker-compose.prod.yml exec -T backend alembic downgrade -1
```

---

## 5. 장애 대응

### 5.1 API 다운

**증상**: nginx 502/504, /health timeout

**확인**:
```bash
docker compose -f docker-compose.prod.yml ps backend
docker compose -f docker-compose.prod.yml logs backend --tail=100
```

**복구**:
```bash
# 재시작
docker compose -f docker-compose.prod.yml restart backend
# OOM 확인
docker inspect $(docker compose -f docker-compose.prod.yml ps -q backend) | grep -i oom
# 코드 버그 -> 롤백
```

---

### 5.2 DB 연결 실패

**증상**: 500 + connection refused / too many connections

**확인**:
```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U academi -c "SELECT count(*) FROM pg_stat_activity;"
docker compose -f docker-compose.prod.yml exec db \
  psql -U academi -c "SELECT pid, state, wait_event_type, query
    FROM pg_stat_activity WHERE state != 'idle';"
```

**복구**:
```bash
# 유휴 연결 정리
docker compose -f docker-compose.prod.yml exec db \
  psql -U academi -c "SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle' AND state_change < now() - interval '10 minutes';"
# DB 재시작
docker compose -f docker-compose.prod.yml restart db
# 이후 앱 재시작
docker compose -f docker-compose.prod.yml restart backend celery-collect celery-process celery-beat
```

---

### 5.3 Redis 다운

**증상**: Celery 태스크 실행 안 됨, ConnectionError: Redis

**확인**:
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
docker compose -f docker-compose.prod.yml exec redis redis-cli info memory
```

**복구**:
```bash
docker compose -f docker-compose.prod.yml restart redis
# eviction 확인
docker compose -f docker-compose.prod.yml exec redis redis-cli info stats | grep evicted_keys
# Celery 재시작
docker compose -f docker-compose.prod.yml restart celery-collect celery-process celery-beat
```

---

### 5.4 Celery 큐 적체 (> 500)

**증상**: Grafana academi-queue-backlog 알림

**확인**:
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN collect
docker compose -f docker-compose.prod.yml exec redis redis-cli LLEN process
docker compose -f docker-compose.prod.yml logs celery-process --tail=200 | grep -i "retry\|MaxRetries"
```

**복구**:
```bash
# 스케일 아웃
docker compose -f docker-compose.prod.yml up -d --scale celery-process=4
# 무한 실패 -> 큐 퍼지 (주의!)
docker compose -f docker-compose.prod.yml exec redis redis-cli DEL process
# 정상화 후 복원
docker compose -f docker-compose.prod.yml up -d --scale celery-process=1
```

---

### 5.5 디스크 부족

**확인**:
```bash
df -h
docker system df
```

**복구**:
```bash
docker image prune -af --filter "until=168h"
docker builder prune -af
docker compose -f docker-compose.prod.yml exec db psql -U academi -c "CHECKPOINT;"
find /srv/academi.ai/infra/scripts/backups/ -mtime +7 -delete
```

---

### 5.6 전면 장애

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic current
```

---

## 6. 백업

### 수동 백업
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U academi --format=custom academi \
  | gzip > /srv/academi.ai/infra/scripts/backups/academi-$(date +%Y%m%d).sql.gz
```

### S3 업로드
```bash
aws s3 cp backups/academi-YYYYMMDD.sql.gz s3://$S3_BUCKET/pg-backups/ --storage-class STANDARD_IA
```

### 복구
```bash
gunzip -c academi-YYYYMMDD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_restore -U academi --dbname=academi --clean --if-exists --no-owner
docker compose -f docker-compose.prod.yml restart backend celery-collect celery-process celery-beat
```

---

## 7. 인증서

certbot이 12시간마다 자동 갱신합니다.

### 수동 갱신
```bash
docker compose -f docker-compose.prod.yml exec certbot certbot renew --force-renewal
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 8. 시크릿 로테이션

```bash
# DB 비밀번호
docker compose -f docker-compose.prod.yml exec db \
  psql -U postgres -c "ALTER USER academi WITH PASSWORD 'NEW';"
# .env 업데이트 -> 재배포

# NEXTAUTH_SECRET (전세션 무효화)
openssl rand -hex 32
# .env 업데이트 -> frontend 재시작
```

---

## 9. 신규 서버

```bash
curl -fsSL https://get.docker.com | sh
sudo mkdir -p /srv/academi.ai && sudo chown $USER /srv/academi.ai
cd /srv/academi.ai
git clone https://github.com/hdj82-bot/academi.ai.git .
cp .env.example .env && vi .env
docker compose -f docker-compose.prod.yml up -d nginx
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot -d your-domain.com
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
```

---

## 10. SLO

| 지표 | 목표 | 측정 |
|---|---|---|
| 가용성 | 99.5%/월 | uptime check |
| API p95 | < 800ms | http_request_duration_seconds |
| 에러율 | < 1% | 5xx / total |
| 백업 신선도 | < 25h | S3 latest object |
| Celery 큐 | < 500 | celery_queue_length |
