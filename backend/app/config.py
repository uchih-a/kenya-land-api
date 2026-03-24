from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY:   str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Optional — empty string if not using Gemini
    GEMINI_API_KEY: str = ""

    # Default points to redis service name in docker-compose
    REDIS_URL: str = "redis://redis:6379"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()