# 베타 운영 일일 모니터링 체크리스트 (5분)

베타 단계 동안 매일 1회 5분 안에 끝낼 수 있도록 구성. 어느 항목에서 이상 신호가 잡히면 그 시점에 멈추고 즉시 조치.

> 자동 점검 vs 수동 점검: 자동은 curl 1줄, 수동은 대시보드 클릭. 베타 졸업(아래 §6) 후 이 루틴은 종료.

---

## 1. `/health` 응답 (자동, 30초)

```bash
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}s\n" https://academi-ai.onrender.com/health
```

판정:
- ✅ `{"status":"ok"}` + `HTTP:200` + `TIME:< 1.5s`
- ⚠ `TIME:> 3s` → Render 콜드스타트 또는 DB 응답 지연. 1분 후 재시도, 지속되면 §3
- ❌ `HTTP:5xx` 또는 timeout → 즉시 §3 + Sentry 확인

---

## 2. Sentry 신규 이슈 (수동, 1분)

1. https://sentry.io → academi 프로젝트 → **Issues** 탭
2. 필터: `is:unresolved age:-24h` (지난 24시간 신규)
3. 판정:
   - 0건 → 다음 항목
   - 1~2건 → 스택트레이스 확인 → 사용자 영향 평가
     - 401/QuotaExceededError 등 사용자 입력 기반 → 무시 또는 resolve
     - 5xx, AttributeError, KeyError → 핫픽스 후보, GitHub Issue 생성
   - 3건 이상 같은 시그니처 → 회귀 가능성, 즉시 조치

---

## 3. Render 에러 로그 (수동, 1분)

1. https://dashboard.render.com → academi-ai → **Logs**
2. 필터: 지난 24시간, level=error 또는 keyword=`Traceback`
3. 판정:
   - 정상 운영 패턴(rate limit, 외부 API 일시 오류) → 무시
   - 반복되는 동일 트레이스 → §2 Sentry 이슈와 매칭 확인
   - DB 연결 실패 / Redis 타임아웃 → Neon/Redis 대시보드 확인

---

## 4. 신규 가입자 수 (수동, 30초)

운영 DB(Neon) SQL editor에서:

```sql
SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours';
SELECT COUNT(*) FROM users;
```

기록: 일일 증감, 누적. 졸업 기준(§6) 추적용.

---

## 5. Gemini API 사용량 (수동, 1분)

1. https://aistudio.google.com → API keys → 해당 프로젝트 → **Quota**
2. 일일 요청 수 / 분당 RPM / 토큰 사용량 확인
3. 판정:
   - 무료 티어 한도 50% 미만 → OK
   - 50~80% → 모니터링 강화, 베타 사용자 증가율 검토
   - 80% 초과 → 유료 플랜 전환 또는 throttle PR 검토

> **참고**: 동기 처리(Celery 비활성) 정책 하에서는 사용자 1명의 액션이 즉시 Gemini를 호출 → 동시 사용자 N명 = RPM N. RPM 제한이 가장 먼저 걸림.

---

## 6. 베타 졸업 기준

다음 조건을 모두 만족하면 베타 운영 단계 종료, Phase 2 착수 검토:

- [ ] **7일 연속 무사고**: §1~3 모두 정상, Sentry 신규 critical 0건
- [ ] **활성 가입자 N명 도달** (목표값은 별도 설정 — academi.md "베타 운영 단계" 참조)
- [ ] **핵심 기능 사용률**: 가입자 중 50% 이상이 논문 검색 + 설문 생성 1회 이상 실행
- [ ] **Gemini API 사용량이 무료 티어 80% 미만** 유지

졸업 후 다음 단계는 [.github/NEXT_TASKS.md](NEXT_TASKS.md) 참조.

---

## 7. 이상 신호 발생 시 에스컬레이션

| 신호 | 즉시 조치 | 후속 |
|---|---|---|
| `/health` 지속 5xx | Render Manual Deploy → Clear cache | 원인 분석 후 hotfix PR |
| Sentry 동일 트레이스 3건+ | git revert 후보 PR 식별 | hotfix or revert |
| DB 연결 실패 | Neon 대시보드 → 인스턴스 상태 확인 | 필요 시 플랜 업그레이드 |
| Gemini RPM 초과 | 사용자에게 일시적 안내 표시 검토 | throttle 또는 유료 전환 |
