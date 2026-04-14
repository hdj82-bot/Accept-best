from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 인증
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
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/academi"
    REDIS_URL: str = "redis://localhost:6379/0"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    SENTRY_DSN: str = ""

    # 개발 편의
    USE_FIXTURES: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
