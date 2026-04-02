from app.api.health import router as health_router
from app.api.users import router as users_router
from app.api.research import router as research_router
from app.api.papers import router as papers_router
from app.api.versions import router as versions_router
from app.api.survey import router as survey_router
from app.api.export import router as export_router
from app.api.billing import router as billing_router
from app.api.admin import router as admin_router
from app.api.bookmarks import router as bookmarks_router
from app.api.share import router as share_router
from app.api.meta import router as meta_router
from app.api.payment import router as payment_router
from app.api.collections import router as collections_router
from app.api.references import router as references_router

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
    "bookmarks_router",
    "share_router",
    "meta_router",
    "payment_router",
    "collections_router",
    "references_router",
]
