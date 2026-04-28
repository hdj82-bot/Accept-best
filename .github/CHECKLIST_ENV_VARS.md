# Production 환경변수 점검 체크리스트

이 문서는 Vercel(Next.js) ↔ Render(FastAPI) 분리 배포 환경에서 **인증 플로우가 동작하기 위한** 환경변수 설정을 사용자가 직접 점검할 때 사용합니다. 코드를 보지 않고 운영자만 보고 끝낼 수 있도록 작성되었습니다.

> 자동 검증으로 확인된 내용 / 사용자가 대시보드에서 직접 확인해야 하는 내용을 분리해 두었습니다. ✅ = 자동 검증 통과, ❌ = 자동 검증 실패(즉시 조치), ⚠ = 사람만 확인 가능.

---

## 0. 자동 검증 결과 요약 (이 문서 작성 시점)

| 항목 | 결과 | 근거 |
|---|---|---|
| Render 백엔드 `/health` 응답 | ✅ 200 `{"status":"ok"}` | `curl https://academi-ai.onrender.com/health` |
| Render `/api/auth/verify` 무토큰 → 401 `Not authenticated` | ✅ 정상 | 코드 경로 동작 확인 |
| Render `/api/auth/verify` 잘못된 토큰 → 401 `Invalid token` | ✅ 정상 | python-jose 검증 경로 동작 |
| Render CORS — `Origin: http://localhost:3000` preflight | ✅ 200, `Access-Control-Allow-Origin` 응답 | 기본값 동작 |
| Render CORS — `Origin: https://academi-8jd5bvxja-hdj82-bots-projects.vercel.app` preflight | ❌ **400, Allow-Origin 미응답** | **CORS_ORIGINS에 production Vercel 도메인 미등록 — 즉시 조치 필요** |
| Vercel production URL 외부 접근 | ⚠ 401 (Vercel Deployment Protection 활성) | SSO 벽 뒤라 무인증 사용자 접근 불가. 의도된 것이면 OK, 일반 공개 서비스라면 해제 필요 |
| `NEXTAUTH_SECRET` Vercel ↔ Render byte-exact 일치 | ⚠ 사용자 수동 확인 | 외부에서 검증 불가 |
| Vercel `NEXT_PUBLIC_API_URL` 실제 등록 여부 | ⚠ 사용자 수동 확인 | 빌드된 클라이언트 번들을 봐야 가능 |

**요점**: 자동 검증으로 확인된 production 차단 이슈 1건 — Render `CORS_ORIGINS` 누락. §2.4 절차 따라 조치하세요.

---

## 1. 점검 대상 환경변수 목록 (코드에서 추출)

| 변수 | Vercel | Render | 출처(코드) |
|---|---|---|---|
| `NEXTAUTH_SECRET` | ✓ | ✓ (동일 값) | `auth.ts:12,37`, `backend/app/core/auth.py:26`, `backend/app/core/config.py:6` |
| `GOOGLE_CLIENT_ID` | ✓ | (선택, 미사용) | `auth.ts:8`, `render.yaml:20` |
| `GOOGLE_CLIENT_SECRET` | ✓ | (선택, 미사용) | `auth.ts:9`, `render.yaml:22` |
| `NEXT_PUBLIC_API_URL` | ✓ | — | `lib/api.ts:1` |
| `CORS_ORIGINS` | — | ✓ | `backend/app/core/config.py:32`, `backend/app/main.py:35` |
| `DATABASE_URL` | — | ✓ | `backend/app/core/config.py:22` |
| `REDIS_URL` | — | ✓ | `backend/app/core/config.py:23` |
| `SENTRY_DSN` | (선택) | (선택) | `backend/app/main.py:23` |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `DEEPL_API_KEY` / `SS_API_KEY` | — | ✓ (기능별) | `render.yaml`, `.env.example` |

**핵심 인증 3종**: `NEXTAUTH_SECRET`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS`. 이 3개만 맞아도 로그인 → 검색 호출 200까지 성공합니다.

---

## 2. 변수별 점검 절차

### 2.1 `NEXTAUTH_SECRET` — Vercel ↔ Render byte-exact 일치

**왜 중요**: Next.js가 이 값으로 HS256 서명 → FastAPI가 같은 값으로 검증. 한 글자만 달라도 모든 인증 API가 401 `Invalid token`.

**값 형식**:
- 32바이트 이상의 임의 문자열 (권장: 64문자 hex)
- 생성 예: `openssl rand -hex 32` 또는 `openssl rand -base64 48`
- 앞뒤 공백·줄바꿈 없어야 함 (대시보드 UI에서 paste 시 흔한 실수)

**Vercel 확인 (대시보드)**:
1. https://vercel.com/dashboard → academi 프로젝트 → **Settings → Environment Variables**
2. `NEXTAUTH_SECRET` 행이 **Production** 환경에 존재 확인
3. 값을 한 번 reveal → 메모장 등에 복사 (양 끝 공백/개행 확인)

**Render 확인 (대시보드)**:
1. https://dashboard.render.com → academi-ai 서비스 → **Environment**
2. `NEXTAUTH_SECRET` 행 → reveal → 위에서 복사한 값과 **byte-exact 비교**
3. 값이 다르면: Render의 값을 Vercel과 동일하게 수정 → **Manual Deploy → Clear build cache & deploy**

**검증** (수정 후): §2.3 의 e2e 시나리오 실행. 200이 나오면 일치, 401이 계속 나오면 불일치.

**점검 빈도**: 한 번 점검하면 끝. 단 시크릿 로테이션할 때 양쪽 동시에 갱신 필수.

---

### 2.2 `NEXT_PUBLIC_API_URL` — Vercel만 (빌드타임 임베드)

**왜 중요**: `lib/api.ts:1`에 fallback이 `http://localhost:8000`. Vercel 빌드 시점에 이 값이 없으면 클라이언트 번들에 localhost가 박혀 production에서 모든 API 호출 실패.

**값 형식**:
- Render 백엔드 base URL, 끝에 슬래시 없음
- 예: `https://academi-ai.onrender.com`
- ❌ `https://academi-ai.onrender.com/` (trailing slash → 경로 결합 시 `//api/...` 됨)
- ❌ `https://academi-ai.onrender.com/api` (`/api`는 `lib/api.ts`에서 붙임)

**Vercel 확인 (대시보드)**:
1. Settings → Environment Variables → `NEXT_PUBLIC_API_URL` 행 존재 확인
2. **Production** 환경에 체크되어 있는지 확인 (Preview/Development만 체크되어 있으면 production 빌드에 안 들어감)
3. 값이 위 형식과 일치하는지 확인

**검증 (브라우저, 가장 확실)**:
1. production 사이트 접속 → DevTools(F12) → Network 탭 → 검색 같은 API 호출 발생시키기
2. 호출 URL이 `https://academi-ai.onrender.com/api/papers/search?...` 형태면 OK
3. `http://localhost:8000/...` 또는 `Failed to fetch`면 → env 누락. Vercel에 추가 후 **Redeploy 필수** (이 변수는 빌드타임에 번들에 박히므로 env만 추가하고 재배포 안 하면 반영 안 됨).

**검증 (curl)**: 외부에서 직접 확인 불가. 브라우저 DevTools 또는 Vercel CLI(`vercel env pull`) 필요.

**점검 빈도**: 한 번 점검 + 백엔드 도메인 변경 시.

---

### 2.3 `CORS_ORIGINS` — Render만 (JSON list 형식 주의)

**왜 중요**: 프론트가 다른 origin에서 백엔드를 호출할 때, 브라우저는 preflight(`OPTIONS`)부터 보냄. 백엔드가 origin을 허용하지 않으면 preflight 실패 → 실제 요청 자체가 막힘. **이 시점에 자동 검증으로 production 도메인이 누락되어 있음을 확인했습니다.**

**값 형식 (pydantic-settings 파싱 규칙)**:
- ✅ JSON 배열 문자열: `["https://academi.vercel.app","https://academi-8jd5bvxja-hdj82-bots-projects.vercel.app"]`
- ❌ 콤마 분리: `https://a.vercel.app,https://b.vercel.app` → 파싱 실패 → 기본값(localhost) fallback
- ❌ 공백 포함: `[ "https://..." ]` (앞뒤 공백은 허용되지만 안전하게 trim)
- ❌ trailing slash: `"https://academi.vercel.app/"` → origin 매칭 안 됨 (브라우저는 origin에 path를 안 붙임)
- 모든 production · preview alias를 포함해야 함. Vercel deployment-specific URL(`academi-XXXX-...vercel.app`)도 매번 바뀌므로, 가능하면 stable alias(`academi.vercel.app`)를 등록하고 그 alias로 OAuth/접근 통일.

**Render 확인 (대시보드)**:
1. Render Dashboard → academi-ai → **Environment**
2. `CORS_ORIGINS` 행의 값 확인. 위 형식과 비교.
3. **현재 값이 production Vercel 도메인을 포함하지 않으면 즉시 추가 후 Save → 자동 redeploy 대기**

**검증 (자동, curl)** — 이 명령을 그대로 복붙해서 origin만 바꿔 실행:
```bash
curl -sS -D - -o /dev/null -X OPTIONS \
  -H "Origin: https://academi-8jd5bvxja-hdj82-bots-projects.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  https://academi-ai.onrender.com/api/papers/search \
  | grep -iE "^HTTP|access-control-allow-origin"
```

판정:
- `HTTP/1.1 200 OK` + `access-control-allow-origin: https://...vercel.app` → ✅ 통과
- `HTTP/1.1 400 Bad Request` + Allow-Origin 헤더 없음 → ❌ origin 미등록 (현재 상태)

**점검 빈도**: 매 production alias/도메인 추가/변경 시. preview 배포에서도 사용한다면 preview URL 패턴도 등록 검토.

---

### 2.4 즉시 조치 절차 (이 문서의 자동 검증으로 확인된 이슈)

```
Render Dashboard → academi-ai → Environment → CORS_ORIGINS
값(예시):
  ["https://academi-8jd5bvxja-hdj82-bots-projects.vercel.app",
   "https://academi.vercel.app",
   "http://localhost:3000"]
Save → 자동 redeploy 시작 → 1~2분 대기 → 위 curl 명령 재실행 → 200 확인
```

**그 다음** 브라우저 시크릿 창으로 production 사이트 접속해 §3 e2e 체크리스트 진행.

---

## 3. 매 배포 후 e2e 체크리스트 (브라우저 5분)

> Vercel Deployment Protection이 활성 상태면 1번 단계에서 막힘. 운영자만 SSO로 통과해 진행하거나, Production 환경에서 보호를 끄세요.

1. **시크릿 창**으로 production URL 접속 → `/login` 카드 보임
2. "Google로 시작하기" 클릭 → Google 동의 → `/dashboard` 도달
   - `redirect_uri_mismatch` 에러 → Google Cloud Console에 `https://<현재도메인>/api/auth/callback/google` 추가
3. DevTools Console에서:
   ```js
   await fetch('/api/auth/session').then(r => r.json())
   ```
   응답 객체에 `accessToken: "eyJ..."` 필드 존재 확인 (없으면 `NEXTAUTH_SECRET` 확인)
4. `/papers` → 검색어 입력 → Network 탭 확인:
   - 호출 URL: `https://academi-ai.onrender.com/api/papers/search?...` (localhost면 §2.2)
   - Request Headers에 `Authorization: Bearer eyJ...` 존재
   - Response: 200 → 전 구간 OK
   - **CORS error in console** → §2.3 (Render `CORS_ORIGINS`)
   - **401 Invalid token** → §2.1 (시크릿 불일치)
   - **401 Not authenticated** → 프론트가 헤더를 안 보냄 → 세션이 끊긴 것 (재로그인)

---

## 4. 한 번만 점검 vs 매 배포 후

### 한 번 점검하면 끝
- `NEXTAUTH_SECRET` 양쪽 일치 (시크릿 로테이션 시에만 재점검)
- `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN`
- Google Cloud Console의 OAuth Redirect URI 등록
- Vercel Deployment Protection 정책

### 매 production 배포 후 점검
- §3 e2e 시나리오 (자동화된 e2e 테스트가 없으므로 사람이 5분 클릭)
- 새 production alias가 추가됐다면 Render `CORS_ORIGINS`에 반영 + Google OAuth Redirect URI에 반영

### 환경변수만 바꿨다면 재빌드 필요 여부
- `NEXT_PUBLIC_*` (예: `NEXT_PUBLIC_API_URL`) → **Vercel Redeploy 필수** (빌드타임 번들에 박힘)
- 그 외 Vercel 서버 전용 env (`NEXTAUTH_SECRET`, `GOOGLE_*`) → 다음 함수 콜드스타트부터 반영
- Render env → Save 시 자동 redeploy

---

## 5. 부록 — Google OAuth Redirect URI 등록

1. https://console.cloud.google.com/ → 프로젝트 선택 → APIs & Services → Credentials
2. OAuth 2.0 Client ID(Web application) 클릭
3. **Authorized redirect URIs**에 production용 콜백 등록:
   ```
   https://<vercel-production-domain>/api/auth/callback/google
   ```
4. deployment-specific URL을 그대로 쓰면 배포마다 URL이 바뀌어 등록과 불일치 → stable alias(`https://academi.vercel.app`) 등록 권장
5. Save 후 Google 측 반영까지 1~5분 소요

## 6. 부록 — Vercel Deployment Protection 끄기 (공개 서비스인 경우)

1. Vercel Dashboard → 프로젝트 → **Settings → Deployment Protection**
2. Production Deployments → **Disabled** 또는 Standard Protection만 유지(team 멤버는 SSO, 외부 사용자는 통과)
3. Preview Deployments는 보호를 유지하는 것이 보통 안전
