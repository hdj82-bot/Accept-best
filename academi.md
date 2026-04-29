# academi.md — 프로젝트 컨텍스트 (개발자/Claude용)

## 이 파일의 역할

**대상**: 코드를 작성/수정하는 개발자와 Claude Code 세션.
**범위**: 프로젝트 전체의 **아키텍처 결정사항, DB 스키마, 핵심 코드 패턴**의 단일 출처(SoT).

> 운영자/외부 방문자용 개요는 [README.md](README.md), Claude 세션 운영 룰은 [CLAUDE.md](CLAUDE.md), 비-Claude 에이전트용 룰은 [AGENTS.md](AGENTS.md)를 참고하세요.

새 태스크 착수 전 반드시 이 파일을 먼저 확인하고 기존 구조에 맞게 코드를 작성하세요.

---

## 프로젝트 개요

- **서비스명**: 논문집필 도우미 (Research Writing Assistant)
- **타깃**: 한국 대학교 교수·박사과정 연구자
- **개발 방식**: 1인 Claude Code 개발, 완성도 우선
- **현재 단계**: Sprint 7 완료 — 베타 배포 (2026-04 기준)

> 사용 모델 정책은 [CLAUDE.md](CLAUDE.md)에서 관리합니다. 이 파일에서는 다루지 않습니다.

---

## 확정된 아키텍처 결정사항 (절대 변경 금지)

### 임베딩 모델
- **모델**: `gemini-embedding-001` (Google Gemini API, `google-genai` SDK)
- **차원**: `vector(1536)` — 이미 DB 스키마에 반영됨
- **차원 고정**: `embed_content` 호출 시 `output_dimensionality=1536` 명시 (Matryoshka — 768/1536/3072 중 1536 선택)
- **절대 변경 불가**: 바꾸면 전체 papers 테이블 재임베딩 필요

### 대화 정책 — 소크라테스식 질문 기반 (Phase 1 핵심)

**원칙**: 모든 LLM 응답(요약·설문 문항·건강검진·노트→초안 등)은 **단정적 결론 제시 대신 연구자에게 되묻는 형식**으로 마무리한다. 연구자가 답한 내용이 다음 단계의 입력이 된다.

**왜**:
- academi.ai의 핵심 가치는 "AI가 논문을 써준다"가 아니라 "AI가 연구자의 사고를 자극하고 함께 완성한다"이다.
- 연구자의 답변이 누적될수록 (1) 개인 사용자의 맥락 정합도가 높아지고 (2) 익명화된 질문/응답 패턴이 시스템 개선에 활용된다.
- 단정적 답변은 연구자의 사고를 가두지만, 질문은 사고를 확장한다.

**구체 예시**:

| ❌ 단정형 (금지) | ✅ 질문형 (권장) |
|---|---|
| "이 논문 주제는 A 방식으로 집필하면 좋겠습니다." | "이 주제를 선정하신 이유는 무엇인가요? 세부 목차는 어떻게 구상하고 계세요?" |
| "방법론은 혼합 연구가 적합합니다." | "정량/정성 중 어떤 자료가 더 충분히 모이실 것 같나요? 응답자 접근성은 어떠세요?" |
| "이 설문 문항을 추천합니다." | "이 변수를 측정하실 때 가장 우선시하는 차원이 무엇인가요? 5점 척도와 7점 척도 중 어느 쪽이 선행연구와 비교 가능하실까요?" |

**적용 위치 (시스템 프롬프트 작성 시 필수 반영)**:
- `app/services/summary_service.py` — 요약 응답 마지막에 "이 논문에서 가장 활용 가치 있는 부분이 어떤 곳인가요?" 류 후속 질문 1~2개
- `app/services/survey_service.py` — 설문 문항 제안 시 "이 변수를 측정하실 때 가장 우선시하는 차원이 무엇인가요?" 류 사전 질문 단계 추가
- `app/services/diagnosis_service.py` (논문 건강검진) — 진단 결과를 "이 부분에서 무엇을 의도하셨나요?"로 되묻기
- `app/services/note_to_draft_service.py` — 초안 변환 전 "이 노트들의 공통 주장은 무엇인가요?" 류 정리 질문

**예외**: 다음 경우만 단정형 허용
- 사실 인용(예: "이 논문은 2021년 출간되었습니다")
- 시스템 상태(예: "수집 완료, 12편입니다")
- 사용자가 명시적으로 "결정해줘"라고 요청한 경우

**데이터 활용**: 연구자의 답변은 (1) 해당 사용자의 다음 작업 컨텍스트로 재사용 (2) 익명화·집계된 질문-응답 패턴은 시스템 개선에 활용. 개별 답변 원문이 다른 사용자에게 노출되거나 외부 모델 학습에 사용되지 않는다 ([FAQ "AI 학습 사용 여부"](docs/FAQ.md) 참조).

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
- **베타 단계 (Render)**: Celery 비활성 (`CELERY_DISABLED=1`), 모든 처리 동기 실행. Render worker 서비스 비용($14/월) 회피 목적. 베타 트래픽 데이터 확인 후 재평가.

---

## 프로젝트 디렉토리 구조

```
project-root/
├── README.md             ← 운영자/외부 방문자용
├── academi.md            ← 이 파일 (개발자/Claude용)
├── CLAUDE.md             ← Claude Code 세션 룰
├── AGENTS.md             ← 비-Claude 에이전트 룰
├── docker-compose.yml
├── .env.example          ← 환경변수 정본
├── docs/                 ← 베타 사용자 가이드, FAQ
├── .github/
│   └── CHECKLIST_ENV_VARS.md  ← production 환경변수 점검
├── backend/              ← FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/          ← 라우터
│   │   ├── models/       ← SQLAlchemy 모델
│   │   ├── schemas/      ← Pydantic 스키마
│   │   ├── services/     ← 비즈니스 로직
│   │   ├── tasks/        ← Celery 태스크
│   │   └── core/
│   │       ├── auth.py   ← JWT 검증 미들웨어
│   │       ├── exceptions.py ← 에러 표준화
│   │       └── config.py ← 환경변수
│   ├── tests/
│   │   └── fixtures/
│   │       └── papers.json ← 시드 데이터 10편
│   ├── alembic/          ← DB 마이그레이션
│   └── requirements.txt
└── (frontend는 레포 루트의 app/, components/, lib/, package.json)
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

## 환경변수

정본은 [`.env.example`](.env.example)입니다. 운영자 시점의 위치별 등록 가이드는 [README.md의 환경변수 표](README.md#환경변수-표), production 점검 절차는 [`.github/CHECKLIST_ENV_VARS.md`](.github/CHECKLIST_ENV_VARS.md)를 참고하세요.

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

## 베타 운영 단계

- **시작일**: 2026-04-29
- **현재 상태**: Sprint 7 베타 배포 직후, 안정화·관찰 단계
- **일일 모니터링 루틴**: [.github/BETA_OPS_DAILY.md](.github/BETA_OPS_DAILY.md) — 매일 5분
- **다음 작업 후보**: [.github/NEXT_TASKS.md](.github/NEXT_TASKS.md) — 졸업 후 Phase 2 착수

### 졸업 기준 (모두 충족 시 Phase 2 착수)

- 7일 연속 무사고 (`/health` 200, Sentry critical 0건)
- 활성 가입자 누적 30명 (목표값, 베타 데이터로 재조정 가능)
- 가입자 중 50% 이상이 핵심 기능(논문 검색 + 설문 생성) 1회 이상 실행
- Gemini API 사용량이 무료 티어 80% 미만 유지

### 베타 단계 한정 정책

- **Celery 비활성** (`CELERY_DISABLED=1`): 모든 처리 동기 실행. Render worker 비용($14/월) 회피.
- **카카오 OAuth 미지원**: Google만. Phase 2에서 재검토 ([NEXT_TASKS.md #3](.github/NEXT_TASKS.md)).
- **e2e 자동화 없음**: 매 배포 후 사람이 [CHECKLIST_ENV_VARS.md §3](.github/CHECKLIST_ENV_VARS.md) 5분 수동 점검.
