# 논문집필 도우미 — Claude Code 컨텍스트

## 이 파일의 역할
Claude Code가 세션 시작 시 자동으로 읽는 파일입니다.
새 태스크 착수 전 반드시 이 파일을 먼저 확인하고 기존 구조에 맞게 코드를 작성하세요.

---

## 프로젝트 개요
- **서비스명**: 논문집필 도우미 (Research Writing Assistant)
- **타깃**: 한국 대학교 교수·박사과정 연구자
- **개발 방식**: 1인 Claude Code 개발, 완성도 우선
- **사용 모델**: Claude Opus 4.7 (`claude-opus-4-7`, 1M context) 고정 — 모든 코드 작성·리뷰·리팩토링은 이 모델로만 진행. 다운그레이드 금지
- **현재 단계**: Sprint 7 완료 — 베타 배포

---

## 확정된 아키텍처 결정사항 (절대 변경 금지)

### 임베딩 모델
- **모델**: `gemini-embedding-001` (Google Gemini API, `google-genai` SDK)
- **차원**: `vector(1536)` — 이미 DB 스키마에 반영됨
- **차원 고정**: `embed_content` 호출 시 `output_dimensionality=1536` 명시 (Matryoshka — 768/1536/3072 중 1536 선택)
- **절대 변경 불가**: 바꾸면 전체 papers 테이블 재임베딩 필요

### 인증 구조
```
브라우저 → Next.js(next-auth) → Google OAuth → JWT 발급
브라우저 → FastAPI → JWT 서명 검증만 (DB 조회 없음)
```
- next-auth와 FastAPI가 `NEXTAUTH_SECRET` 공유
- FastAPI는 `python-jose`로 HS256 검증만 수행
- **카카오 OAuth는 Phase 1 없음** (Phase 2에서 재검토)

### Celery 큐 분리
- `collect` 큐: arXiv·SS API 수집 (느림, sleep(3) 필수)
- `process` 큐: Claude API 요약·임베딩·설문 (빠름, 사용자 대기)
- Docker Compose에서 워커 2개 항상 분리 실행

---

## 프로젝트 디렉토리 구조

```
project-root/
├── CLAUDE.md              ← 이 파일
├── docker-compose.yml
├── .env.example
├── backend/               ← FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/           ← 라우터
│   │   ├── models/        ← SQLAlchemy 모델
│   │   ├── schemas/       ← Pydantic 스키마
│   │   ├── services/      ← 비즈니스 로직
│   │   ├── tasks/         ← Celery 태스크
│   │   └── core/
│   │       ├── auth.py    ← JWT 검증 미들웨어
│   │       ├── exceptions.py ← 에러 표준화
│   │       └── config.py  ← 환경변수
│   ├── tests/
│   │   └── fixtures/
│   │       └── papers.json ← 시드 데이터 10편
│   ├── alembic/           ← DB 마이그레이션
│   └── requirements.txt
└── frontend/              ← Next.js
    ├── app/               ← App Router
    ├── components/
    └── package.json
```

---

## 핵심 코드 패턴

### 에러 처리 (app/core/exceptions.py)
```python
class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 500):
        self.code = code
        self.message = message
        self.status = status

class RateLimitError(AppError):
    def __init__(self, service: str):
        super().__init__("RATE_LIMIT", f"{service} rate limit. retry later.", 429)

class QuotaExceededError(AppError):
    def __init__(self, feature: str):
        super().__init__("QUOTA_EXCEEDED", f"{feature} monthly limit reached.", 402)

class ExternalAPIError(AppError):
    def __init__(self, service: str, detail: str = ""):
        super().__init__("EXTERNAL_API", f"{service} error: {detail}", 502)
```

### Celery 태스크 라우팅
```python
# app/tasks/__init__.py
CELERY_TASK_ROUTES = {
    "app.tasks.collect.*": {"queue": "collect"},
    "app.tasks.process.*": {"queue": "process"},
}

# 수집 태스크 예시
@celery_app.task(queue="collect", autoretry_for=(RateLimitError,), retry_backoff=True)
def collect_papers(user_id: str, keyword: str):
    ...

# 처리 태스크 예시
@celery_app.task(queue="process")
def summarize_paper(paper_id: str):
    ...
```

### FastAPI JWT 검증
```python
# app/core/auth.py
from jose import JWTError, jwt

SECRET_KEY = os.getenv("NEXTAUTH_SECRET")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401)
        return user_id
    except JWTError:
        raise HTTPException(status_code=401)
```

### 플랜 접근 제어
```python
# app/core/auth.py
def plan_required(min_plan: str):
    plan_order = {"free": 0, "basic": 1, "pro": 2}
    def decorator(func):
        async def wrapper(*args, user_id=Depends(get_current_user), **kwargs):
            user = await get_user(user_id)
            if plan_order[user.plan] < plan_order[min_plan]:
                raise QuotaExceededError(func.__name__)
            return await func(*args, user_id=user_id, **kwargs)
        return wrapper
    return decorator

# 사용 예시
@router.post("/survey/generate")
@plan_required("basic")
async def generate_survey(user_id=Depends(get_current_user)):
    ...
```

### monthly_usage 사용량 추적
```python
# INSERT ON CONFLICT UPDATE — Celery 초기화 불필요
async def increment_usage(user_id: str, field: str, db: AsyncSession):
    year_month = datetime.now().strftime("%Y-%m")
    await db.execute(
        text(f"""
            INSERT INTO monthly_usage (user_id, year_month, {field})
            VALUES (:user_id, :ym, 1)
            ON CONFLICT (user_id, year_month)
            DO UPDATE SET {field} = monthly_usage.{field} + 1
        """),
        {"user_id": user_id, "ym": year_month}
    )
```

---

## DB 핵심 테이블 (Phase 1)

| 테이블 | 핵심 컬럼 | 비고 |
|--------|-----------|------|
| users | id, email, provider, plan, plan_expires_at | Google OAuth |
| monthly_usage | user_id, year_month, research_count, ... | (user_id, year_month) UNIQUE |
| papers | id, embedding vector(1536), author_ids TEXT[], keywords TEXT[], (source, source_id) UNIQUE | 임베딩 차원 절대 변경 금지 |
| survey_questions | id, user_id, paper_id, original_q, adapted_q, source_title, source_page, year | 핵심 차별점 |
| paper_versions | id, user_id, content JSONB, save_type(auto/manual), created_at | auto: 최근 10개, manual: 무제한 |
| research_notes | id, user_id, content, created_at | 노트→초안 변환 연동 |

---

## 환경변수 목록 (.env.example)

```
# 인증 (next-auth와 FastAPI 동일 값 필수)
NEXTAUTH_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI API
GEMINI_API_KEY=          # 텍스트 생성 + 임베딩(1536차원) 통합

# 번역 (Phase 2에서 활성화)
DEEPL_API_KEY=

# 논문 수집
SS_API_KEY=              # Semantic Scholar, 일 1,000건 무료

# 인프라
DATABASE_URL=            # postgresql://...
REDIS_URL=               # redis://...
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
SENTRY_DSN=

# 개발 편의
USE_FIXTURES=true        # 개발 중 true, 배포 시 false
```

---

## Sprint 진행 현황

- [x] Sprint 0: 환경 세팅
- [x] Sprint 1: 인증 + 플랜 관리
- [x] Sprint 2: 논문 수집 파이프라인
- [x] Sprint 3: 설문문항 자동 생성 (핵심 차별점)
- [x] Sprint 4: 논문 건강검진 + 공유 카드
- [x] Sprint 5: 논문 버전 관리 + AI 연구 노트
- [x] Sprint 6: 참고문헌 + 연구 공백 발견
- [x] Sprint 7: 베타 배포 ← **완료**

---

## Claude Code 작업 원칙

1. **컨텍스트 선주입**: 새 태스크 착수 전 관련 기존 코드를 먼저 보여주고 요청
2. **계획 먼저**: 복잡한 태스크는 "코드 쓰지 말고 계획만 먼저 말해줘"
3. **테스트 동시 요청**: 기능 구현 시 pytest도 함께 요청
4. **막히면 분해**: 한 번에 하나씩. 동작 확인 후 다음 단계
5. **완료 기준 준수**: 기준 미달이면 다음 태스크 진행 금지
6. **모델 고정**: 모든 작업은 Opus 4.7(`claude-opus-4-7`, 1M context)로 수행. Sonnet/Haiku로 다운그레이드 금지. 세션 시작 시 `/model claude-opus-4-7`로 확인

---

## 현재 Sprint 0 체크리스트

- [ ] GitHub 레포 생성. main·develop 브랜치. .env.example 작성
- [ ] docker-compose up 성공. pgvector 익스텐션 활성화 확인
- [ ] 6개 테이블 생성. papers.embedding vector(1536) 확인
- [ ] celery_collect 워커 실행 + Flower에서 큐 확인
- [ ] celery_process 워커 실행 + Flower에서 큐 확인
- [ ] GET /health → {"status":"ok"} 반환
- [ ] AppError → {"error":"...", "message":"..."} JSON 반환
- [ ] pytest 실행 시 fixtures 10편 자동 시딩
- [ ] Next.js localhost:3000 렌더링
- [ ] Sentry 에러 수신 확인
- [ ] FastAPI /docs Swagger UI 확인
- [ ] .env가 .gitignore에 포함됨 확인
