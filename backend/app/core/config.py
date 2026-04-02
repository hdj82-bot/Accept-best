import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Auth
    nextauth_secret: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

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

    # Monitoring
    sentry_dsn: str = ""

    # Development
    use_fixtures: bool = True
    debug: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
