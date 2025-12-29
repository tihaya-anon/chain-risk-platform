from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    app_name: str = "risk-ml-service"
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8082, alias="PORT")

    # PostgreSQL
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=15432, alias="POSTGRES_PORT")
    postgres_user: str = Field(default="chainrisk", alias="POSTGRES_USER")
    postgres_password: str = Field(default="chainrisk123", alias="POSTGRES_PASSWORD")
    postgres_db: str = Field(default="chainrisk", alias="POSTGRES_DB")

    # Redis
    redis_host: str = Field(default="localhost", alias="REDIS_HOST")
    redis_port: int = Field(default=16379, alias="REDIS_PORT")
    redis_password: str = Field(default="", alias="REDIS_PASSWORD")
    redis_db: int = Field(default=1, alias="REDIS_DB")

    # Query Service
    query_service_url: str = Field(
        default="http://localhost:8081", alias="QUERY_SERVICE_URL"
    )

    # Risk scoring thresholds
    high_risk_threshold: float = Field(default=0.7, alias="HIGH_RISK_THRESHOLD")
    medium_risk_threshold: float = Field(default=0.4, alias="MEDIUM_RISK_THRESHOLD")

    # Large transaction threshold (in wei, default 10 ETH)
    large_tx_threshold: str = Field(
        default="10000000000000000000", alias="LARGE_TX_THRESHOLD"
    )

    # Cache TTL (seconds)
    cache_ttl: int = Field(default=300, alias="CACHE_TTL")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
