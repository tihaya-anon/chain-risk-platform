import os
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from functools import lru_cache

import yaml
from dotenv import load_dotenv


@dataclass
class ServerConfig:
    name: str = "risk-ml-service"
    port: int = 8082
    env: str = "development"


@dataclass
class DatabaseConfig:
    host: str = "localhost"
    port: int = 15432
    user: str = "chainrisk"
    password: str = "chainrisk123"
    dbname: str = "chainrisk"
    sslmode: str = "disable"

    @property
    def url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.dbname}"
        )


@dataclass
class RedisConfig:
    host: str = "localhost"
    port: int = 16379
    password: str = ""
    db: int = 1
    cache_ttl: int = 300

    @property
    def url(self) -> str:
        if self.password:
            return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
        return f"redis://{self.host}:{self.port}/{self.db}"


@dataclass
class QueryServiceConfig:
    url: str = "http://localhost:8081"
    timeout: int = 10


@dataclass
class RiskConfig:
    high_risk_threshold: float = 0.7
    medium_risk_threshold: float = 0.4
    large_tx_threshold: str = "10000000000000000000"  # 10 ETH in wei


@dataclass
class LoggingConfig:
    level: str = "INFO"
    format: str = "console"  # console or json
    output_paths: list[str] = field(default_factory=lambda: ["stdout", "logs/risk-ml-service.log"])


@dataclass
class Config:
    server: ServerConfig = field(default_factory=ServerConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    query_service: QueryServiceConfig = field(default_factory=QueryServiceConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


def load_config(config_path: Optional[str] = None) -> Config:
    """Load configuration from YAML file and environment variables."""
    # Load .env.local if exists
    env_paths = [
        Path(__file__).parent.parent.parent / ".env.local",
        Path(__file__).parent.parent.parent.parent.parent / ".env.local",
        Path(".env.local"),
    ]
    for env_path in env_paths:
        if env_path.exists():
            load_dotenv(env_path)
            break

    # Determine config path
    if config_path is None:
        config_path = os.getenv("CONFIG_PATH", "configs/config.yaml")

    # Load YAML config
    config_file = Path(config_path)
    if not config_file.is_absolute():
        # Try relative to service directory
        service_dir = Path(__file__).parent.parent.parent
        config_file = service_dir / config_path

    yaml_config = {}
    if config_file.exists():
        with open(config_file, "r") as f:
            yaml_config = yaml.safe_load(f) or {}

    # Build config with YAML defaults
    config = Config(
        server=_build_server_config(yaml_config.get("server", {})),
        database=_build_database_config(yaml_config.get("database", {})),
        redis=_build_redis_config(yaml_config.get("redis", {})),
        query_service=_build_query_service_config(yaml_config.get("queryService", {})),
        risk=_build_risk_config(yaml_config.get("risk", {})),
        logging=_build_logging_config(yaml_config.get("logging", {})),
    )

    # Override with environment variables
    _override_from_env(config)

    return config


def _build_server_config(data: dict) -> ServerConfig:
    return ServerConfig(
        name=data.get("name", "risk-ml-service"),
        port=data.get("port", 8082),
        env=data.get("env", "development"),
    )


def _build_database_config(data: dict) -> DatabaseConfig:
    return DatabaseConfig(
        host=data.get("host", "localhost"),
        port=data.get("port", 15432),
        user=data.get("user", "chainrisk"),
        password=data.get("password", "chainrisk123"),
        dbname=data.get("dbname", "chainrisk"),
        sslmode=data.get("sslmode", "disable"),
    )


def _build_redis_config(data: dict) -> RedisConfig:
    return RedisConfig(
        host=data.get("host", "localhost"),
        port=data.get("port", 16379),
        password=data.get("password", ""),
        db=data.get("db", 1),
        cache_ttl=data.get("cacheTTL", 300),
    )


def _build_query_service_config(data: dict) -> QueryServiceConfig:
    return QueryServiceConfig(
        url=data.get("url", "http://localhost:8081"),
        timeout=data.get("timeout", 10),
    )


def _build_risk_config(data: dict) -> RiskConfig:
    return RiskConfig(
        high_risk_threshold=data.get("highRiskThreshold", 0.7),
        medium_risk_threshold=data.get("mediumRiskThreshold", 0.4),
        large_tx_threshold=data.get("largeTxThreshold", "10000000000000000000"),
    )


def _build_logging_config(data: dict) -> LoggingConfig:
    return LoggingConfig(
        level=data.get("level", "INFO"),
        format=data.get("format", "console"),
        output_paths=data.get("outputPaths", ["stdout", "logs/risk-ml-service.log"]),
    )


def _override_from_env(config: Config) -> None:
    """Override config values from environment variables."""
    # Server
    if env_val := os.getenv("APP_ENV"):
        config.server.env = env_val
    if env_val := os.getenv("PORT"):
        config.server.port = int(env_val)

    # Database
    if env_val := os.getenv("POSTGRES_HOST"):
        config.database.host = env_val
    if env_val := os.getenv("POSTGRES_PORT"):
        config.database.port = int(env_val)
    if env_val := os.getenv("POSTGRES_USER"):
        config.database.user = env_val
    if env_val := os.getenv("POSTGRES_PASSWORD"):
        config.database.password = env_val
    if env_val := os.getenv("POSTGRES_DB"):
        config.database.dbname = env_val

    # Redis
    if env_val := os.getenv("REDIS_HOST"):
        config.redis.host = env_val
    if env_val := os.getenv("REDIS_PORT"):
        config.redis.port = int(env_val)
    if env_val := os.getenv("REDIS_PASSWORD"):
        config.redis.password = env_val

    # Query Service
    if env_val := os.getenv("QUERY_SERVICE_URL"):
        config.query_service.url = env_val

    # Risk thresholds
    if env_val := os.getenv("HIGH_RISK_THRESHOLD"):
        config.risk.high_risk_threshold = float(env_val)
    if env_val := os.getenv("MEDIUM_RISK_THRESHOLD"):
        config.risk.medium_risk_threshold = float(env_val)
    if env_val := os.getenv("LARGE_TX_THRESHOLD"):
        config.risk.large_tx_threshold = env_val

    # Logging
    if env_val := os.getenv("LOG_LEVEL"):
        config.logging.level = env_val


# Global config instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get the global config instance."""
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reset_config() -> None:
    """Reset the global config instance (for testing)."""
    global _config
    _config = None
