from app.api.health import router as health_router
from app.api.users import router as users_router
from app.api.research import router as research_router
from app.api.papers import router as papers_router
from app.api.versions import router as versions_router
from app.api.survey import router as survey_router
from app.api.export import router as export_router
from app.api.billing import router as billing_router
from app.api.admin import router as admin_router

__all__ = [
    "health_router",
    "users_router",
    "research_router",
    "papers_router",
    "versions_router",
    "survey_router",
    "export_router",
    "billing_router",
    "admin_router",
]
