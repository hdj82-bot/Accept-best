from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Auth
    nextauth_secret: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Kakao OAuth
    kakao_client_id: str = ""
    kakao_client_secret: str = ""

    # AI APIs
    openai_api_key: str = ""       # text-embedding-3-small
    anthropic_api_key: str = ""    # Claude API
    gemini_api_key: str = ""

    # Translation (Phase 2)
    deepl_api_key: str = ""

    # Paper collection
    ss_api_key: str = ""           # Semantic Scholar

    # Infrastructure
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/academi"
    redis_url: str = "redis://localhost:6379/0"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""

    # PortOne (결제)
    portone_api_key: str = ""
    portone_api_secret: str = ""
    portone_webhook_secret: str = ""

    # Monitoring
    sentry_dsn: str = ""

    # Production
    domain: str = ""  # e.g. "academi.ai"
    cors_origins: str = "http://localhost:3000"  # comma-separated

    # Development — USE_FIXTURES=true only in local dev / CI
    use_fixtures: bool = False
    debug: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.domain:
            origins.append(f"https://{self.domain}")
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
