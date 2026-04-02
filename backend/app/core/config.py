from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 인증 — next-auth와 FastAPI 동일 값 필수
    NEXTAUTH_SECRET: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # AI API
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # 번역
    DEEPL_API_KEY: str = ""

    # 논문 수집
    SS_API_KEY: str = ""

    # 인프라
    DATABASE_URL: str = "postgresql+asyncpg://academi:academi@db:5432/academi"
    REDIS_URL: str = "redis://redis:6379/0"
    SENTRY_DSN: str = ""

    # AWS
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""

    # 개발 편의
    USE_FIXTURES: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
