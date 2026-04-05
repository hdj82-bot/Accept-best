# academi.ai Launch Checklist

> 1회성 런치용 체크리스트. 배포 절차 상세는 [DEPLOY.md](DEPLOY.md) 참고.

---

## 1. 배포 전 확인사항

### 1.1 코드 검증

- [ ] `main` 브랜치에 모든 기능 머지 완료
- [ ] GitHub Actions CI 전체 통과 (test-backend, test-frontend, e2e, lint)
- [ ] Alembic 마이그레이션 체인 무결성 확인 (`None → 0001 → ... → 0007` 선형)
- [ ] `USE_FIXTURES=false` 상태에서 백엔드 테스트 통과 확인
- [ ] Playwright E2E 8개 spec 전체 통과

### 1.2 환경변수 설정

서버에 `.env` 파일 생성 (`.env.production.example` 기반):

- [ ] `NEXTAUTH_SECRET` — `openssl rand -base64 32`로 생성
- [ ] `POSTGRES_PASSWORD` — `openssl rand -base64 24`로 생성
- [ ] `DATABASE_URL` — POSTGRES_PASSWORD와 일치하는지 확인
- [ ] `NEXTAUTH_URL=https://academi.ai`
- [ ] `DOMAIN=academi.ai`
- [ ] `CORS_ORIGINS=https://academi.ai`
- [ ] `USE_FIXTURES=false`
- [ ] `DEBUG=false`
- [ ] `NEXT_PUBLIC_API_URL=https://academi.ai/api`
- [ ] `NEXT_PUBLIC_APP_URL=https://academi.ai`
- [ ] `NEXT_PUBLIC_USE_FIXTURES=false`

### 1.3 외부 서비스 API 키

- [ ] **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] **Kakao OAuth**: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- [ ] **OpenAI**: `OPENAI_API_KEY` (text-embedding-3-small 사용 가능 확인)
- [ ] **Anthropic**: `ANTHROPIC_API_KEY` (Claude API 사용 가능 확인)
- [ ] **DeepL**: `DEEPL_API_KEY` (번역 API)
- [ ] **Semantic Scholar**: `SS_API_KEY`
- [ ] **PortOne**: `PORTONE_API_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`
- [ ] **PortOne 가맹점 ID**: `NEXT_PUBLIC_IMP_MERCHANT_ID`
- [ ] **AWS S3**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- [ ] **Sentry**: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`

### 1.4 외부 서비스 OAuth Redirect URI 설정

#### Google Cloud Console
- [ ] Authorized redirect URI: `https://academi.ai/api/auth/callback/google`
- [ ] Authorized JavaScript origin: `https://academi.ai`

#### Kakao Developers
- [ ] Redirect URI: `https://academi.ai/api/auth/callback/kakao`
- [ ] 플랫폼 등록: Web — `https://academi.ai`
- [ ] 동의항목: 닉네임, 이메일 (필수동의)

#### PortOne (아임포트) 관리자
- [ ] Webhook URL: `https://academi.ai/payment/webhook`
- [ ] 허용 도메인: `academi.ai`
- [ ] 테스트 결제 → 실결제 모드 전환

### 1.5 인프라 준비

- [ ] 서버 사양: 2vCPU, 4GB RAM, 40GB SSD 이상 (Ubuntu 22.04+)
- [ ] Docker + Docker Compose 설치
- [ ] 방화벽: 80, 443 포트 개방
- [ ] DNS A 레코드: `academi.ai` → 서버 IP
- [ ] Docker Hub 계정 + 이미지 push 권한

### 1.6 GitHub Secrets 설정

- [ ] `DOCKERHUB_USERNAME`
- [ ] `DOCKERHUB_TOKEN`
- [ ] `DEPLOY_HOST` (서버 IP)
- [ ] `DEPLOY_USER` (SSH 유저)
- [ ] `DEPLOY_SSH_KEY` (SSH 프라이빗 키)
- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `NEXT_PUBLIC_SENTRY_DSN`

---

## 2. 배포 실행

### 2.1 초기 SSL 인증서 발급
```bash
cd /srv/academi.ai
export DOMAIN=academi.ai
export EMAIL=admin@academi.ai
./infra/scripts/init-ssl.sh
```

### 2.2 서비스 시작
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 2.3 DB 마이그레이션
```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### 2.4 DB 백업 크론 등록
```bash
echo "0 3 * * * cd /srv/academi.ai && ./infra/scripts/backup.sh" | crontab -
```

---

## 3. 배포 후 확인사항

### 3.1 서비스 상태 확인

- [ ] `curl https://academi.ai/health` → `{"status":"ok"}`
- [ ] `curl https://academi.ai` → Next.js 페이지 렌더링
- [ ] `curl -I https://academi.ai` → HTTP/2 200, HSTS 헤더 존재

### 3.2 핵심 기능 수동 검증

- [ ] Google 로그인 → 대시보드 진입 성공
- [ ] Kakao 로그인 → 대시보드 진입 성공
- [ ] 논문 검색 (키워드 입력 → 결과 표시)
- [ ] 논문 번역 (번역 버튼 → 한국어 표시)
- [ ] 연구 노트 작성 → 자동저장 동작
- [ ] 설문문항 생성 (basic 플랜 이상)
- [ ] 참고문헌 추가 → BibTeX 내보내기
- [ ] 컬렉션 생성 → 논문 추가
- [ ] 결제 테스트 (PortOne 테스트 모드에서)
- [ ] PDF/Markdown 내보내기

### 3.3 보안 확인

- [ ] SSL 인증서 유효 (`openssl s_client -connect academi.ai:443`)
- [ ] HSTS 헤더: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] `/api/metrics` 외부 접근 차단 (404)
- [ ] Rate limiting 동작: `/api/papers/search` 10req/min

### 3.4 모니터링 확인

- [ ] Sentry: 백엔드 에러 수신 확인 (의도적 에러 발생)
- [ ] Sentry: 프론트엔드 에러 수신 확인
- [ ] Prometheus 메트릭 수집 확인 (`docker compose exec prometheus wget -qO- http://backend:8000/metrics`)
- [ ] DB 백업 수동 실행 확인 (`./infra/scripts/backup.sh`)

### 3.5 성능 확인

- [ ] 논문 검색 응답 시간 < 3초
- [ ] 페이지 초기 로드 < 2초
- [ ] `docker stats`로 메모리 사용량 확인 (총 2.5GB 이내)

---

## 4. 롤백 절차

### 자동 롤백 (deploy.yml)
GitHub Actions 배포 시 health check 실패하면 자동으로 이전 이미지 태그로 롤백됨.

### 수동 롤백
```bash
# 1. 이전 이미지 태그 확인
cat /srv/academi.ai/.current-tag

# 2. 이전 태그로 되돌리기
export IMAGE_TAG=<previous-sha>
docker compose -f docker-compose.prod.yml up -d

# 3. 마이그레이션 롤백 (필요 시)
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1

# 4. 상태 확인
curl https://academi.ai/health
```

### DB 복원 (긴급 시)
```bash
# 최근 백업 파일 확인
ls -lt /srv/academi.ai/infra/scripts/backups/

# 복원
gunzip -c backups/academi_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose exec -T db psql -U academi -d academi
```

---

## 5. 런치 당일 타임라인

| 시각 | 작업 | 담당 |
|------|------|------|
| T-2h | `.env` 최종 확인, DNS 전파 상태 확인 | - |
| T-1h | `main` 브랜치 최종 CI 확인 | - |
| T-0  | `git push origin main` → 자동 배포 트리거 | - |
| T+5m | health check 자동 통과 확인 | - |
| T+10m | 수동 검증 (섹션 3.2 체크) | - |
| T+15m | Sentry 에러 없는지 확인 | - |
| T+30m | 외부 접근 테스트 (모바일, 다른 네트워크) | - |
| T+1h | PortOne 실결제 모드 전환 | - |
| T+2h | 런치 완료 공지 | - |

---

## 6. 런치 후 유지보수

- SSL 인증서: certbot 컨테이너가 12시간마다 자동 갱신
- DB 백업: 매일 03:00 자동 실행, 14일 보관
- 모니터링: Prometheus alert rules (BackendDown, HighErrorRate, SlowPaperSearch, HighDiskUsage)
- 로그 확인: `docker compose -f docker-compose.prod.yml logs -f --tail=100`
