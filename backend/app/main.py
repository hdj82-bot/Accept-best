import logging

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.api import (
    health_router, users_router, research_router, papers_router,
    versions_router, survey_router, export_router,
    billing_router, admin_router, bookmarks_router, share_router,
    meta_router, collections_router, references_router, translate_router,
)

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="논문집필 도우미 API",
    description="Research Writing Assistant — academi.ai backend",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Error handler ─────────────────────────────────────────────────────────────

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"error": exc.code, "message": exc.message},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health_router)
app.include_router(users_router, prefix="/api")
app.include_router(research_router, prefix="/api")

app.include_router(papers_router, prefix="/api")
app.include_router(versions_router, prefix="/api")
app.include_router(survey_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(bookmarks_router, prefix="/api")
app.include_router(share_router, prefix="/api")
app.include_router(meta_router, prefix="/api")
app.include_router(collections_router, prefix="/api")
app.include_router(references_router, prefix="/api")
app.include_router(translate_router, prefix="/api")


# ── Prometheus metrics ─────────────────────────────────────────────────────────

@app.get("/metrics", include_in_schema=False)
async def metrics(request: Request):
    # 내부 네트워크(Docker)에서만 접근 허용
    forwarded = request.headers.get("X-Forwarded-For", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
    internal_prefixes = ("127.", "10.", "172.", "192.168.", "::1")
    if client_ip and not any(client_ip.startswith(p) for p in internal_prefixes):
        return Response(status_code=403)
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
