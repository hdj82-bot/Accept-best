import sentry_sdk
from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler

# Sentry 초기화
if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1)

app = FastAPI(
    title="논문집필 도우미 API",
    description="Research Writing Assistant for Korean academics",
    version="0.1.0",
)

# 에러 핸들러
app.add_exception_handler(AppError, app_error_handler)

# 라우터
app.include_router(health_router)
