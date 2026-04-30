# 운영 알람 룰 명세 (베타)

이 문서는 Accept.best 베타 운영 단계의 **Sentry 알람 룰**과 **Grafana threshold**를 정의합니다. 코드에는 룰 등록 로직을 두지 않고, 본 문서를 단일 소스로 하여 운영자가 각 대시보드에 수동 등록합니다.

> 룰 변경은 반드시 이 문서의 PR로 함께 반영하여 코드 리뷰를 거칩니다. 대시보드 단독 변경 금지(드리프트 방지).

---

## 0. 적용 범위

| 환경 | URL | Sentry environment 태그 |
|---|---|---|
| production | `https://academi-ai.onrender.com` | `production` |
| (예정) staging | — | `staging` |

`SENTRY_ENVIRONMENT` 환경변수로 분리합니다 (`render.yaml` 참조). 알람 룰은 `environment:production`에만 발동시켜 staging 노이즈 차단.

---

## 1. Sentry 알람 룰

### 1.1 5xx 응답률 급증
- **목적**: 백엔드 일반 장애 조기 탐지.
- **조건**: 최근 5분간 `level:error` 이벤트 중 `http.status_code >= 500` 가 **10건 이상** 또는 5분 윈도 이벤트 수가 직전 1시간 평균의 **3배 이상**.
- **환경 필터**: `environment:production`
- **액션**: 운영자 이메일 알림. (Slack 연동은 채널 결정 후 추가)
- **억제(throttle)**: 동일 룰 30분당 1회.

### 1.2 `/api/papers/search` p95 latency
- **목적**: 핵심 검색 엔드포인트 응답 지연 감시.
- **조건**: Performance > Transactions, `transaction:GET /api/papers/search` 의 p95 가 **3,000ms 초과 5분간 연속**.
- **환경 필터**: `environment:production`
- **액션**: 운영자 이메일 알림.
- **참고**: arXiv 외부 API 호출 의존(`backend/app/api/papers.py:35`)이라 외부 지연 시 같이 튐 → 첫 발동 시 arXiv 상태 페이지 확인.

### 1.3 인증 실패 폭증 (선택)
- **목적**: `NEXTAUTH_SECRET` 불일치 / 키 회전 사고 조기 탐지.
- **조건**: 5분간 `tag:invalid_token` 또는 401 응답 이벤트가 평소(7일 평균) 대비 5배.
- **환경 필터**: `environment:production`
- **액션**: 운영자 이메일.
- **트리거 사례**: 토큰/시크릿 값 양쪽 갱신 누락 → 전체 사용자 401 → 즉시 §2.1 점검.

---

## 2. Grafana threshold (Render 메트릭 + Redis exporter)

> Render 자체 메트릭(CPU/Memory/HTTP) + Redis exporter(Celery 큐 길이)를 Grafana로 수집한다는 전제. 미구축 시 항목별 비고 참고.

### 2.1 Celery `collect` 큐 적체
- **메트릭**: `redis_list_length{key="celery:queues:collect"}` (또는 `celery_queue_length{queue="collect"}`)
- **threshold**: 길이 > **50** 5분 연속 → warning, > **200** 5분 연속 → critical
- **이유**: 수집 태스크는 arXiv `sleep(3)` 강제 → 정상 throughput ~20 task/min. 50 이상 쌓이면 사용자 대기 체감.
- **비고**: exporter 미구축이면 임시로 worker 컨테이너의 `celery -A app.tasks inspect active`/`reserved`를 5분 cron으로 찍어 Loki에 보내고 그걸로 alert.

### 2.2 Celery `process` 큐 적체
- **메트릭**: `redis_list_length{key="celery:queues:process"}`
- **threshold**: 길이 > **20** 3분 연속 → warning, > **100** 3분 연속 → critical
- **이유**: 사용자 대기 큐. 임베딩/요약. p95 처리시간 ~10s 가정 → 20 이상이면 200초 대기.

### 2.3 5xx 응답률 (Render HTTP)
- **메트릭**: Render 자체 HTTP 메트릭 `5xx_count / total_count` 5분 평균.
- **threshold**: > **2%** 5분 연속 → warning, > **5%** 5분 연속 → critical.
- **이유**: Sentry 룰(§1.1)과 중복 보강. Sentry는 캡처 누락 가능성 있고, Render HTTP 메트릭은 누락 없음.

### 2.4 `/api/papers/search` p95 latency (자체 측정)
- **메트릭**: Sentry Performance에서 export 또는 백엔드 자체 access log → Loki/Grafana.
- **threshold**: p95 > **3,000ms** 5분 연속 → warning, > **8,000ms** 5분 연속 → critical.
- **이유**: §1.2와 동일. Grafana 대시보드에는 panel만 두고 alert는 Sentry로 일원화 권장 (중복 페이지 방지).

### 2.5 DB connection 사용률 (선택, 베타 후반 활성)
- **메트릭**: `pg_stat_activity` 활성 connection 수 / max_connections.
- **threshold**: > **80%** 5분 연속 → warning.
- **이유**: 동시 사용자 증가 시 connection pool 고갈 조기 탐지.

---

## 3. 등록 절차 (운영자용)

### 3.1 Sentry
1. Sentry organization → Project `academi-api` → Alerts → Create Alert
2. 위 §1.x 항목별로 룰 1건씩 생성. environment 필터 `production` 명시.
3. 액션: 1차는 이메일만(운영자 1인). 베타 사용자 50명 돌파 시 Slack 채널 추가.

### 3.2 Grafana
1. Grafana 대시보드 `academi-beta-overview` 생성(없으면).
2. 위 §2.x 메트릭 panel 추가.
3. panel 별 alert rule 생성 — threshold/duration 본 문서 그대로.
4. Notification channel: Sentry 룰과 동일 이메일.

### 3.3 변경 시
- threshold 조정/룰 추가 → 본 문서 PR + 대시보드 동시 갱신.
- 베타 30일 후 1차 튜닝 회고 (false positive/missed incident 분석).

---

## 4. 의도적으로 알람을 두지 않는 항목

- 4xx 일반 (사용자 입력 오류 등) — 노이즈 과다.
- 단발성 외부 API 5xx (arXiv, Semantic Scholar) — 자동 retry 흡수. 단 §2.1 큐 적체로 간접 탐지.
- Vercel(프론트엔드) — Vercel Analytics + Sentry Browser SDK가 필요하나 베타 1차에는 미도입. 후속 트랙.

---

## 5. 환경변수 의존성

본 문서에서 참조하는 알람의 데이터 소스는 다음 환경변수에 의존합니다 (`render.yaml` 정의):

| 변수 | 용도 |
|---|---|
| `SENTRY_DSN` | Sentry 이벤트 송신. 미설정 시 §1 알람 무력화. |
| `SENTRY_ENVIRONMENT` | 룰의 environment 필터에 사용. production/staging 분리 필수. |
| `SENTRY_TRACES_SAMPLE_RATE` | §1.2 latency 측정 표본률. 베타 동안 `0.1` 유지 권장(비용/정확도 균형). |
| `REDIS_URL` | §2.1, §2.2 Celery 큐 메트릭 수집(Redis exporter). |
