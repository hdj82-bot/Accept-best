# 다음 작업 후보 (베타 졸업 후 Phase 2 착수)

베타 운영 단계 졸업 기준([BETA_OPS_DAILY.md §6](BETA_OPS_DAILY.md#6-베타-졸업-기준)) 충족 후 검토할 작업 목록.

> 이 파일은 **결정된 작업** 리스트가 아니라 **후보** 리스트. 우선순위는 베타 데이터 확인 후 재평가.

---

## 1. Gemini 재임베딩 `--apply` 실제 실행

**상태**: 스크립트 머지 완료 (PR #35), dry-run/apply 미실행.

**조건**: 운영 DB(Neon) DATABASE_URL로 dry-run 우선.

**액션**:
```bash
cd backend
python -m scripts.reembed_papers --filter pre-cutover           # dry-run
python -m scripts.reembed_papers --filter pre-cutover --apply   # 실행
python -m scripts.reembed_papers --filter null --apply          # catch-up
```

**결정 게이트**:
- 후보 N >= 500 → `--rate-limit-per-min` 옵션 추가 PR 먼저
- 후보 N < 50 → 즉시 실행
- catch-up이 매일 발생 → 수집 파이프라인 재점검

---

## 2. Celery 활성화 재평가

**현재**: `CELERY_DISABLED=1`, 모든 처리 동기 — Render worker 비용($14/월) 회피 ([academi.md "Celery 큐 분리"](../academi.md#celery-큐-분리)).

**재평가 트리거**:
- 베타 동시 사용자 5명 이상 → 동기 처리로 한 명이 30초~수분 블로킹 → UX 한계
- Gemini RPM 한도 근접 → 큐 기반 throttle 필요
- /health 응답 시간이 동기 처리 영향으로 지속 3초 초과

**비용 분석**:
- worker 2개 ($14/월) vs 단일 worker ($7/월, 큐 분리 정책 위반)
- Redis 무료 티어(10K cmd/일) 한도 초과 시 +$7/월 (Upstash Pay-As-You-Go)
- 총 +$14~$21/월 예상

**대안**: FastAPI BackgroundTasks로 부분 비동기화 — Celery 없이 동일 프로세스에서 백그라운드 실행. 비용 0, 단 프로세스 재시작 시 손실 위험.

---

## 3. 카카오 OAuth 추가

**현재**: Google OAuth만. ([academi.md "인증 구조"](../academi.md#인증-구조))

**조건**: 한국 대학교 교수·박사과정이 타깃이므로 카카오 비중 클 수 있음. 베타 가입자 중 "Google 계정 없음" 피드백 비율 확인 후 결정.

**구현 부담**:
- next-auth Kakao provider 추가 (1~2시간)
- backend `python-jose`는 변경 없음 (next-auth가 동일 NEXTAUTH_SECRET으로 서명)
- `users.provider` 컬럼은 이미 존재 → 스키마 변경 불필요
- Google Cloud Console 대신 Kakao Developers 콘솔에서 OAuth Redirect URI 등록

---

## 4. 사용량 대시보드 (관리자 전용)

**현재**: `monthly_usage` 테이블에 데이터는 쌓이지만 조회 UI 없음.

**구현 범위**:
- `/admin/usage` 라우트 신설 (운영자 이메일 화이트리스트 인증)
- 사용자별 / 월별 / 기능별 사용량 테이블
- 플랜별 한도 도달률 차트
- Gemini API 호출 카운트 (별도 컬럼 추가 또는 Sentry breadcrumb 분석)

**선결 과제**: 운영자 권한 모델 정의 (현재 없음).

---

## 5. arxiv_parser 확장 — 다른 수집 소스 통합 후보

**현재**: PR #33으로 arXiv 파싱 통합. Semantic Scholar는 JSON이라 별도 처리.

**후보**: 향후 추가될 수 있는 수집 소스(KCI, RISS 등)도 동일 패턴 적용 — `app/services/<source>_parser.py` 모듈로 분리.

**우선순위 낮음**: 베타 단계는 arXiv + SS만으로 충분.

---

## 6. e2e 자동화 테스트

**현재**: [CHECKLIST_ENV_VARS.md §3](CHECKLIST_ENV_VARS.md)이 사람이 5분 클릭하는 e2e. 매 배포 후 사람이 직접.

**구현 범위**:
- Playwright 또는 Cypress로 로그인 → 검색 → 설문 생성 시나리오 자동화
- GitHub Actions에서 production 배포 후 자동 실행
- 실패 시 Slack/이메일 알림

**조건**: 베타 사용자 수 30명 이상 = 매 배포 후 사람이 매번 클릭하기 부담스러운 시점.

---

## 7. 베타 가입자 피드백 수집 채널

**현재**: GitHub Issues + 이메일(추정).

**검토**:
- 인앱 피드백 위젯 (예: Userback, Canny) — 비용 발생
- 또는 단순 `/feedback` 페이지 + DB 저장 (자체 구현, 비용 0)
- 베타 가입자에게 매주 이메일 설문 (수동, 10명 이하 한정 효과적)

---

## 우선순위 가이드 (베타 졸업 시점에 재평가)

| 우선순위 | 후보 | 트리거 |
|---|---|---|
| P0 | #1 재임베딩 apply | 운영 DB dry-run 결과 확인 직후 |
| P1 | #2 Celery 재평가 | 동시 사용자 5명+ 또는 RPM 한도 근접 |
| P1 | #4 사용량 대시보드 | 운영자가 수기 SQL 5회/주 이상 조회 시 |
| P2 | #3 카카오 OAuth | 베타 피드백에서 명시적 요구 발생 시 |
| P2 | #6 e2e 자동화 | 사용자 30명 또는 배포 빈도 주 1회 이상 |
| P3 | #5 arxiv_parser 확장 | 새 수집 소스 추가 결정 시 |
| P3 | #7 피드백 채널 | 현재 Issues로 충분하면 보류 |
