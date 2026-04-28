import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.papers import router as papers_router
from app.api.survey import router as survey_router
from app.api.diagnosis import router as diagnosis_router
from app.api.share import router as share_router
from app.api.paper_versions import router as versions_router
from app.api.research_notes import router as notes_router
from app.api.references import router as references_router
from app.api.research_gaps import router as research_gaps_router
from app.api.plans import router as plans_router
from app.api.translation import router as translation_router
from app.api.users import router as users_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler

# Sentry 초기화
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT or None,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    )

app = FastAPI(
    title="논문집필 도우미 API",
    description="Research Writing Assistant for Korean academics",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 에러 핸들러
app.add_exception_handler(AppError, app_error_handler)

# 라우터 — /api prefix로 통합
app.include_router(health_router)
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(papers_router, prefix="/api")
app.include_router(survey_router, prefix="/api")
app.include_router(diagnosis_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(versions_router, prefix="/api")
app.include_router(notes_router, prefix="/api")
app.include_router(references_router, prefix="/api")
app.include_router(research_gaps_router, prefix="/api")
app.include_router(translation_router, prefix="/api")
