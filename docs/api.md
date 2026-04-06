# API 문서

논문집필 도우미 백엔드 REST API 레퍼런스입니다. 라이브 OpenAPI 스펙은 다음 주소에서 확인할 수 있습니다.

- **Swagger UI**: `https://api.academi.ai/docs`
- **ReDoc**: `https://api.academi.ai/redoc`
- **OpenAPI JSON**: `https://api.academi.ai/openapi.json`

## 인증

모든 보호된 엔드포인트는 요청 헤더에 JWT Bearer 토큰이 필요합니다.

```http
Authorization: Bearer <access_token>
```

토큰은 NextAuth.js 세션을 통해 발급되며, 만료 시 `/api/auth/session` 재발급 로직에 따라 자동 갱신됩니다.

### 에러 응답 포맷

모든 에러는 아래 형식으로 반환됩니다.

```json
{
  "detail": "Rate limit exceeded",
  "code": "rate_limit_exceeded",
  "retry_after": 42
}
```

| HTTP | 의미 |
| --- | --- |
| 400 | 요청 파라미터 오류 |
| 401 | 미인증(토큰 없음/만료) |
| 403 | 권한 부족(플랜 제한 포함) |
| 404 | 리소스 없음 |
| 409 | 충돌(중복 생성 등) |
| 429 | Rate limit 초과 |
| 500 | 서버 내부 오류 |

---

## 엔드포인트 목록 & 예제

### 1. 사용자

#### `GET /api/users/me`

현재 로그인된 사용자 정보를 반환합니다.

**Response 200**
```json
{
  "id": "user-1",
  "email": "hong@example.com",
  "name": "홍길동",
  "plan": "basic",
  "plan_expires_at": "2026-05-06T00:00:00Z"
}
```

#### `GET /api/users/me/usage`

이번 달 사용량 조회.

```json
{ "research_count": 7, "year_month": "2026-04" }
```

#### `PATCH /api/users/me`

**Body**
```json
{ "name": "새로운 이름" }
```

---

### 2. 논문 검색

#### `GET /api/papers/search?query=transformer&year_from=2017&year_to=2023&page=1&per_page=20`

| 파라미터 | 타입 | 설명 |
| --- | --- | --- |
| `query` | string | 검색어 (필수) |
| `year_from` | int | 시작 연도 |
| `year_to` | int | 종료 연도 |
| `source` | string | `arxiv`, `semantic_scholar` 등 |
| `page` | int | 페이지 번호 (1부터) |
| `per_page` | int | 페이지당 항목 수 (max 50) |

**Response 200**
```json
{
  "items": [
    {
      "id": "paper-xyz",
      "title": "Attention Is All You Need",
      "authors": ["Vaswani et al."],
      "abstract": "…",
      "year": 2017,
      "source": "arxiv",
      "is_bookmarked": false
    }
  ],
  "total": 1243,
  "page": 1,
  "pages": 63
}
```

---

### 3. 북마크

#### `POST /api/bookmarks/{paper_id}`
논문 북마크 추가. Body 없음.

#### `DELETE /api/bookmarks/{paper_id}`
북마크 제거.

---

### 4. 컬렉션

#### `GET /api/collections/`
```json
[
  { "id": "col-1", "name": "LLM 서베이", "paper_count": 12, "created_at": "2026-03-15T10:00:00Z" }
]
```

#### `POST /api/collections/`
```json
{ "name": "새 컬렉션", "description": "연구 메모" }
```

#### `POST /api/collections/{id}/papers`
```json
{ "paper_id": "paper-xyz" }
```

#### `DELETE /api/collections/{id}/papers/{paper_id}`

---

### 5. 연구 노트

#### `GET /api/research/`
사용자의 노트 목록. 페이징 지원.

#### `POST /api/research/`
```json
{ "content": "초기 내용", "title": "연구 노트 1" }
```

**Response 201**
```json
{ "id": "note-123", "content": "초기 내용", "created_at": "2026-04-06T10:00:00Z" }
```

#### `PATCH /api/research/{id}`
**Body**
```json
{ "content": "수정된 내용" }
```

---

### 6. 버전

#### `POST /api/versions/`
```json
{ "research_id": "note-123", "content": "...", "save_type": "auto" }
```

`save_type` ∈ `auto` | `manual`.

#### `GET /api/versions/?research_id=note-123`
해당 노트의 버전 히스토리.

#### `POST /api/versions/{version_id}/restore`
지정 버전으로 복원(현재 내용을 새 버전으로 보존한 뒤 교체).

---

### 7. Export

모든 export 작업은 **비동기**입니다.

#### `POST /api/export/{format}/{research_id}`

`format` ∈ `markdown` | `bibtex` | `pdf` | `docx`

**Response 202**
```json
{ "task_id": "task-abc" }
```

#### `GET /api/export/status/{task_id}`
```json
{ "status": "SUCCESS", "download_url": "https://…/files/note.pdf" }
```
`status` ∈ `PENDING` | `STARTED` | `SUCCESS` | `FAILURE`.

---

### 8. 결제 (PortOne)

#### `POST /api/billing/prepare`
**Body**
```json
{ "plan": "basic", "months": 1 }
```

**Response 200**
```json
{ "merchant_uid": "academi_abc123", "amount": 9900 }
```

#### `POST /api/billing/complete`
PortOne 결제 성공 콜백 후 서버 검증.

**Body**
```json
{ "imp_uid": "imp_xxxxxxxx", "merchant_uid": "academi_abc123" }
```

**Response 200**
```json
{ "success": true, "plan": "basic", "expires_at": "2026-05-06T00:00:00Z" }
```

#### `POST /api/billing/cancel`
자동결제 해지. Body 없음.

#### `GET /api/billing/plans`
플랜 목록.

#### `GET /api/billing/current`
현재 플랜/만료일.

---

## Rate Limits

| 엔드포인트 | 한도 |
| --- | --- |
| `POST /api/papers/search` | 60 req/min/user |
| `POST /api/export/*` | 10 req/min/user |
| `POST /api/versions/` | 30 req/min/user |
| 기타 `GET` | 300 req/min/user |

429 응답 시 `retry_after`(초) 대기 후 재시도합니다.

## CORS

허용 origin은 환경변수 `CORS_ORIGINS` 로 설정됩니다. 프로덕션 예:
```
CORS_ORIGINS=https://academi.ai,https://www.academi.ai
```

## Webhooks (예정)

결제 이벤트 알림을 위한 Webhook 발송 기능은 v1.2 에서 추가 예정입니다.
