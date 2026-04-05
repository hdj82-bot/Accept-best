# 보안 감사 체크리스트

프로덕션 배포 전/후 수행하는 보안 점검 항목입니다. 각 체크박스는 담당자가 직접 검증 후 PR에 결과(스크린샷/로그/명령 출력)를 첨부합니다.

> 대상: `backend/app/` (FastAPI), `frontend/` (Next.js), `infra/` (Docker/CI).

---

## 1. 인증 & 세션 (JWT / OAuth)

- [ ] **JWT 서명 알고리즘이 HS256/RS256 명시적 고정** — `alg=none` 혹은 클라이언트 결정 금지.
- [ ] **JWT 만료 시간 준수** — `exp` 클레임 설정, 기본 15분(access) / 7일(refresh).
- [ ] **토큰 회전(rotation)** 확인
  - 리프레시 토큰 재사용 탐지 시 전체 세션 폐기(reuse detection).
  - 테스트: 동일 refresh_token 2회 사용 시 두 번째 요청 401.
- [ ] **만료 토큰 거부** — 만료된 토큰으로 `/api/users/me` 호출 시 401.
- [ ] **서명 변조 거부** — payload 수정 후 원본 서명으로 호출 시 401.
- [ ] **OAuth state 파라미터 CSRF 검증** — Google/Kakao 콜백에서 state 불일치 시 거부.
- [ ] **OAuth 이메일 verified 확인** — provider 응답의 `email_verified=true` 강제.
- [ ] **로그아웃 시 쿠키 Invalidate** — `next-auth.session-token` 제거 후 `/api/users/me` 401 확인.
- [ ] **Secure / HttpOnly / SameSite 쿠키 속성**
  ```
  next-auth.session-token: HttpOnly; Secure; SameSite=Lax
  ```

### 자동화 테스트 예시

```bash
# 만료된 토큰
curl -H "Authorization: Bearer $EXPIRED_JWT" https://api.academi.ai/api/users/me
# expected: 401

# 변조된 토큰
curl -H "Authorization: Bearer ${JWT}x" https://api.academi.ai/api/users/me
# expected: 401
```

---

## 2. Rate Limiting

- [ ] 모든 mutating endpoint(`POST/PUT/DELETE/PATCH`)에 user-scoped rate limit 적용.
- [ ] **IP 단위 추가 제한** — 미인증 요청(`/api/auth/*`)에 대해 IP 기반 제한.
- [ ] **우회 시도 차단 검증**:
  - [ ] `X-Forwarded-For` 스푸핑 — 신뢰 가능한 프록시 IP 외에는 무시.
  - [ ] 다중 User-Agent 로테이션으로 동일 IP에서 우회 불가.
  - [ ] 다중 계정 생성 후 동일 IP 공격 시 IP 제한 발동.
- [ ] 429 응답에 `Retry-After` 헤더 포함.

### 테스트 스크립트

```bash
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $JWT" \
    -X POST https://api.academi.ai/api/papers/search \
    -H "Content-Type: application/json" \
    -d '{"query":"test"}'
done | sort | uniq -c
# expected: 429가 적절한 시점부터 등장
```

---

## 3. SQL Injection

- [ ] **ORM(예: SQLAlchemy) 파라미터 바인딩 사용** — raw string concatenation 금지.
- [ ] 검색·필터 파라미터(`query`, `source`, `year_from`)에 대해 다음 payload 테스트:
  - `' OR 1=1--`
  - `"; DROP TABLE users;--`
  - `\'; SELECT pg_sleep(5);--`
- [ ] ORDER BY / LIMIT 절에 사용자 입력 직접 주입 금지.
- [ ] DB 사용자 권한 최소화 — app user는 DDL 권한 없음.
- [ ] **sqlmap** 자동 스캔
  ```bash
  sqlmap -u "https://api.academi.ai/api/papers/search?query=test" \
         --headers="Authorization: Bearer $JWT" --level=3 --risk=2
  ```

---

## 4. XSS (Cross-Site Scripting)

- [ ] React 자동 escape에 의존하되, `dangerouslySetInnerHTML` 사용처 전수 검증.
  - 현재 사용 위치 확인: `frontend/app/layout.tsx` 의 themeInitScript 뿐.
- [ ] 사용자 생성 콘텐츠(연구 노트, 컬렉션 이름) 렌더링 시 HTML/스크립트 sanitize.
- [ ] CSP(Content Security Policy) 헤더 설정:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.iamport.kr 'nonce-<random>'; frame-src https://*.iamport.kr;
  ```
- [ ] **Reflected XSS 테스트** — 검색 결과 페이지에 `?query=<script>alert(1)</script>` 전달 시 실행 안 됨.
- [ ] **Stored XSS** — 노트 본문/북마크 제목에 `<img src=x onerror=alert(1)>` 저장 후 다른 화면에서 실행 안 됨.
- [ ] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` 헤더.

---

## 5. CSRF

- [ ] NextAuth.js `csrfToken` 검증 활성(`/api/auth/csrf`).
- [ ] 상태 변경 API(`POST/PUT/DELETE`)에 SameSite=Lax 쿠키 + Origin 검증.
- [ ] Webhook 수신(PortOne) 서명 검증 — `X-IMP-Signature` 또는 IP allowlist.

---

## 6. CORS 설정 재검토

- [ ] `Access-Control-Allow-Origin` 에 `*` 사용 금지(자격증명 엔드포인트).
- [ ] 허용 origin 환경변수 화이트리스트:
  ```
  CORS_ORIGINS=https://academi.ai,https://www.academi.ai
  ```
- [ ] 프리뷰 배포용 origin 패턴은 명시적(regex) 관리.
- [ ] `Access-Control-Allow-Credentials: true` 시 origin 필드에 `*` 사용 불가 준수.
- [ ] Preflight 캐시(`Access-Control-Max-Age`) 600초 이하.
- [ ] 실제 테스트:
  ```bash
  curl -i -H "Origin: https://evil.com" https://api.academi.ai/api/users/me
  # expected: CORS 거부 (Origin 헤더 미포함)
  ```

---

## 7. 의존성 / 공급망

- [ ] `npm audit --production` 취약점 Critical/High 0건.
- [ ] `pip-audit` 또는 `safety check` Critical/High 0건.
- [ ] Dockerfile base image 최신 LTS 고정 태그 사용(`:latest` 금지).
- [ ] Trivy 컨테이너 스캔 HIGH/CRITICAL 0건.

---

## 8. 비밀 관리

- [ ] `.env`, API 키, PortOne secret이 git 이력에 포함되지 않음(`git log --all -S`).
- [ ] 프로덕션 시크릿은 환경변수/Secrets Manager에서만 주입.
- [ ] Sentry DSN 노출 허용되나 sampling에 개인정보 scrub 적용.

---

## 9. 로그 & 관측성

- [ ] JWT / Authorization 헤더가 로그에 평문 기록되지 않음.
- [ ] 개인정보(이메일, 이름)는 Sentry `beforeSend`에서 masking.
- [ ] 인증 실패(401) 이벤트 구조화 로깅 & 임계치 알람.

---

## 10. 결제 검증

- [ ] `POST /api/billing/complete`에서 **서버 → PortOne API 재조회**로 `amount` / `status` 재검증 (클라이언트 값 신뢰 금지).
- [ ] `merchant_uid` 중복 처리 방지(멱등성 테이블).
- [ ] 결제 금액과 플랜 가격 테이블 정합성 검증 후 플랜 승급.
- [ ] 환불/취소 웹훅 수신 시 세션·플랜 즉시 하향.

---

## 감사 결과 요약 템플릿

```markdown
## Security Audit — YYYY-MM-DD

- 담당: @username
- 대상 커밋: `<sha>`
- 결과: PASS / FAIL
- 주요 발견:
  1. …
- 후속 조치:
  - [ ] …
```

---

감사 주기: **분기 1회** + 주요 인증/결제 변경 직후.
