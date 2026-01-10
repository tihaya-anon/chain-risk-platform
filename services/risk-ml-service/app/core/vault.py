"""Vault client for secret management."""

import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from loguru import logger


@dataclass
class VaultConfig:
    addr: str
    enabled: bool
    role_id: Optional[str] = None
    secret_id: Optional[str] = None
    token: Optional[str] = None


class VaultClient:
    """HashiCorp Vault client for secret management."""

    def __init__(self) -> None:
        self.config = VaultConfig(
            addr=os.getenv("VAULT_ADDR", "http://localhost:18200"),
            enabled=os.getenv("VAULT_ENABLED", "false").lower() == "true",
            role_id=os.getenv("VAULT_APPROLE_ROLE_ID"),
            secret_id=os.getenv("VAULT_APPROLE_SECRET_ID"),
            token=os.getenv("VAULT_TOKEN"),
        )
        self._token: Optional[str] = None
        self._token_expiry: float = 0
        self._cache: dict[str, tuple[dict[str, Any], float]] = {}
        self._cache_ttl = 300  # 5 minutes

        if self.config.enabled:
            logger.info(f"Vault client initialized: {self.config.addr}")
        else:
            logger.info("Vault disabled, using environment variables")

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    def _authenticate(self) -> None:
        """Authenticate with Vault using AppRole."""
        if self._token and time.time() < self._token_expiry:
            return

        # Try direct token first
        if self.config.token:
            self._token = self.config.token
            self._token_expiry = time.time() + 3600
            return

        # Use AppRole authentication
        if not self.config.role_id or not self.config.secret_id:
            raise ValueError("Vault AppRole credentials not configured")

        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.post(
                    f"{self.config.addr}/v1/auth/approle/login",
                    json={
                        "role_id": self.config.role_id,
                        "secret_id": self.config.secret_id,
                    },
                )
                response.raise_for_status()
                data = response.json()

                self._token = data["auth"]["client_token"]
                ttl = data["auth"].get("lease_duration", 3600)
                self._token_expiry = time.time() + ttl - 60  # Refresh 1 min early

                logger.debug("Vault authentication successful")
        except Exception as e:
            logger.error(f"Vault authentication failed: {e}")
            raise

    def get_secret(self, path: str) -> dict[str, Any]:
        """Get secret from Vault KV v2 engine."""
        if not self.config.enabled:
            raise RuntimeError("Vault is not enabled")

        # Check cache
        if path in self._cache:
            data, expiry = self._cache[path]
            if time.time() < expiry:
                return data

        self._authenticate()

        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(
                    f"{self.config.addr}/v1/secret/data/{path}",
                    headers={"X-Vault-Token": self._token},
                )
                response.raise_for_status()
                result = response.json()

                data = result["data"]["data"]
                self._cache[path] = (data, time.time() + self._cache_ttl)

                logger.debug(f"Secret retrieved from Vault: {path}")
                return data
        except Exception as e:
            logger.error(f"Failed to get secret from Vault: {path}, error: {e}")
            raise

    def get_database_secrets(self) -> dict[str, str]:
        """Get PostgreSQL credentials."""
        if not self.config.enabled:
            return {
                "host": os.getenv("POSTGRES_HOST", "localhost"),
                "port": os.getenv("POSTGRES_PORT", "15432"),
                "user": os.getenv("POSTGRES_USER", "chainrisk"),
                "password": os.getenv("POSTGRES_PASSWORD", "chainrisk123"),
                "database": os.getenv("POSTGRES_DB", "chainrisk"),
            }
        return self.get_secret("chainrisk/database/postgres")

    def get_redis_secrets(self) -> dict[str, str]:
        """Get Redis credentials."""
        if not self.config.enabled:
            return {
                "host": os.getenv("REDIS_HOST", "localhost"),
                "port": os.getenv("REDIS_PORT", "16379"),
                "password": os.getenv("REDIS_PASSWORD", ""),
            }
        return self.get_secret("chainrisk/database/redis")

    def get_neo4j_secrets(self) -> dict[str, str]:
        """Get Neo4j credentials."""
        if not self.config.enabled:
            return {
                "uri": os.getenv("NEO4J_URI", "bolt://localhost:17687"),
                "user": os.getenv("NEO4J_USER", "neo4j"),
                "password": os.getenv("NEO4J_PASSWORD", "chainrisk123"),
            }
        return self.get_secret("chainrisk/database/neo4j")

    def get_minio_secrets(self) -> dict[str, str]:
        """Get MinIO credentials."""
        if not self.config.enabled:
            return {
                "endpoint": os.getenv("MINIO_ENDPOINT", "http://localhost:19000"),
                "access_key": os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
                "secret_key": os.getenv("MINIO_SECRET_KEY", "minioadmin123"),
            }
        return self.get_secret("chainrisk/api/minio")

    def get_api_key(self, service: str) -> str:
        """Get API key for external service."""
        if not self.config.enabled:
            env_key = f"{service.upper()}_API_KEY"
            return os.getenv(env_key, "")
        secrets = self.get_secret(f"chainrisk/api/{service}")
        return secrets.get("key", "")

    def clear_cache(self) -> None:
        """Clear the secret cache."""
        self._cache.clear()
        logger.debug("Secret cache cleared")


# Singleton instance
_vault_client: Optional[VaultClient] = None


def get_vault_client() -> VaultClient:
    """Get the singleton Vault client instance."""
    global _vault_client
    if _vault_client is None:
        _vault_client = VaultClient()
    return _vault_client


def reset_vault_client() -> None:
    """Reset the Vault client (for testing)."""
    global _vault_client
    _vault_client = None
