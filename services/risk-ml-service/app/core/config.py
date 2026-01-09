import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

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
class MinIOConfig:
    endpoint: str = "localhost:19000"
    access_key: str = "minioadmin"
    secret_key: str = "minioadmin123"
    bucket: str = "ml-models"
    secure: bool = False


@dataclass
class TrinoConfig:
    host: str = "localhost"
    port: int = 18081
    user: str = "admin"
    catalog: str = "hudi"
    schema: str = "chainrisk"


@dataclass
class Neo4jConfig:
    uri: str = "bolt://localhost:17687"
    user: str = "neo4j"
    password: str = "chainrisk123"


@dataclass
class MLConfig:
    enabled: bool = True
    gnn_enabled: bool = True
    xgb_enabled: bool = True
    gnn_model: str = "gnn_sage"
    xgb_model: str = "xgboost"
    ensemble_strategy: str = "weighted_avg"
    gnn_weight: float = 0.4
    xgb_weight: float = 0.4
    rules_weight: float = 0.2
    device: str = "cpu"
    model_check_interval: int = 300  # seconds


@dataclass
class Config:
    server: ServerConfig = field(default_factory=ServerConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    query_service: QueryServiceConfig = field(default_factory=QueryServiceConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    minio: MinIOConfig = field(default_factory=MinIOConfig)
    trino: TrinoConfig = field(default_factory=TrinoConfig)
    neo4j: Neo4jConfig = field(default_factory=Neo4jConfig)
    ml: MLConfig = field(default_factory=MLConfig)


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
        minio=_build_minio_config(yaml_config.get("minio", {})),
        trino=_build_trino_config(yaml_config.get("trino", {})),
        neo4j=_build_neo4j_config(yaml_config.get("neo4j", {})),
        ml=_build_ml_config(yaml_config.get("ml", {})),
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


def _build_minio_config(data: dict) -> MinIOConfig:
    return MinIOConfig(
        endpoint=data.get("endpoint", "localhost:19000"),
        access_key=data.get("accessKey", "minioadmin"),
        secret_key=data.get("secretKey", "minioadmin123"),
        bucket=data.get("bucket", "ml-models"),
        secure=data.get("secure", False),
    )


def _build_trino_config(data: dict) -> TrinoConfig:
    return TrinoConfig(
        host=data.get("host", "localhost"),
        port=data.get("port", 18081),
        user=data.get("user", "admin"),
        catalog=data.get("catalog", "hudi"),
        schema=data.get("schema", "chainrisk"),
    )


def _build_neo4j_config(data: dict) -> Neo4jConfig:
    return Neo4jConfig(
        uri=data.get("uri", "bolt://localhost:17687"),
        user=data.get("user", "neo4j"),
        password=data.get("password", "chainrisk123"),
    )


def _build_ml_config(data: dict) -> MLConfig:
    return MLConfig(
        enabled=data.get("enabled", True),
        gnn_enabled=data.get("gnnEnabled", True),
        xgb_enabled=data.get("xgbEnabled", True),
        gnn_model=data.get("gnnModel", "gnn_sage"),
        xgb_model=data.get("xgbModel", "xgboost"),
        ensemble_strategy=data.get("ensembleStrategy", "weighted_avg"),
        gnn_weight=data.get("gnnWeight", 0.4),
        xgb_weight=data.get("xgbWeight", 0.4),
        rules_weight=data.get("rulesWeight", 0.2),
        device=data.get("device", "cpu"),
        model_check_interval=data.get("modelCheckInterval", 300),
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

    # MinIO
    if env_val := os.getenv("MINIO_ENDPOINT"):
        config.minio.endpoint = env_val
    if env_val := os.getenv("MINIO_ACCESS_KEY"):
        config.minio.access_key = env_val
    if env_val := os.getenv("MINIO_SECRET_KEY"):
        config.minio.secret_key = env_val

    # Trino
    if env_val := os.getenv("TRINO_HOST"):
        config.trino.host = env_val
    if env_val := os.getenv("TRINO_PORT"):
        config.trino.port = int(env_val)

    # Neo4j
    if env_val := os.getenv("NEO4J_URI"):
        config.neo4j.uri = env_val
    if env_val := os.getenv("NEO4J_USER"):
        config.neo4j.user = env_val
    if env_val := os.getenv("NEO4J_PASSWORD"):
        config.neo4j.password = env_val

    # ML
    if env_val := os.getenv("ML_ENABLED"):
        config.ml.enabled = env_val.lower() in ("true", "1", "yes")
    if env_val := os.getenv("ML_DEVICE"):
        config.ml.device = env_val

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
