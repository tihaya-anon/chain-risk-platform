import json
from typing import Optional
import redis.asyncio as redis
from app.core.config import get_config
from app.core.logging import get_logger
from app.models.risk import RiskScoreResponse
from app.rules.engine import RuleEngine
from app.services.query_client import QueryServiceClient

logger = get_logger(__name__)


class RiskService:
    """Service for computing risk scores."""

    def __init__(self):
        self.config = get_config()
        self.rule_engine = RuleEngine()
        self.query_client = QueryServiceClient()
        self._redis: Optional[redis.Redis] = None

    async def get_redis(self) -> Optional[redis.Redis]:
        """Get or create Redis connection."""
        if self._redis is None:
            try:
                self._redis = redis.from_url(
                    self.config.redis.url,
                    encoding="utf-8",
                    decode_responses=True,
                )
                await self._redis.ping()
                logger.info("Connected to Redis")
            except Exception as e:
                logger.warning("Failed to connect to Redis, caching disabled", error=str(e))
                self._redis = None
        return self._redis

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def score_address(
        self,
        address: str,
        network: str = "ethereum",
        include_factors: bool = True,
        use_cache: bool = True,
    ) -> RiskScoreResponse:
        """Compute risk score for a single address."""
        address = address.lower()
        cache_key = f"risk:{network}:{address}"

        # Try cache first
        if use_cache:
            cached = await self._get_cached(cache_key)
            if cached:
                cached.cached = True
                if not include_factors:
                    cached.factors = []
                return cached

        # Fetch data from Query Service
        address_info = await self.query_client.get_address_info(address, network)
        transfers = await self.query_client.get_address_transfers(address, network)

        # Evaluate rules
        result = await self.rule_engine.evaluate(
            address=address,
            network=network,
            address_info=address_info,
            transfers=transfers,
            include_factors=include_factors,
        )

        # Cache result
        if use_cache:
            await self._set_cached(cache_key, result)

        return result

    async def score_addresses_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
        include_factors: bool = False,
    ) -> tuple[list[RiskScoreResponse], int]:
        """Compute risk scores for multiple addresses."""
        results: list[RiskScoreResponse] = []
        failed = 0

        for address in addresses:
            try:
                result = await self.score_address(
                    address=address,
                    network=network,
                    include_factors=include_factors,
                    use_cache=True,
                )
                results.append(result)
            except Exception as e:
                logger.error("Failed to score address", address=address, error=str(e))
                failed += 1

        return results, failed

    async def _get_cached(self, key: str) -> Optional[RiskScoreResponse]:
        """Get cached risk score."""
        try:
            redis_client = await self.get_redis()
            if not redis_client:
                return None

            data = await redis_client.get(key)
            if data:
                return RiskScoreResponse.model_validate_json(data)
        except Exception as e:
            logger.warning("Cache read failed", key=key, error=str(e))
        return None

    async def _set_cached(self, key: str, value: RiskScoreResponse) -> None:
        """Cache risk score."""
        try:
            redis_client = await self.get_redis()
            if not redis_client:
                return

            await redis_client.setex(
                key,
                self.config.redis.cache_ttl,
                value.model_dump_json(),
            )
        except Exception as e:
            logger.warning("Cache write failed", key=key, error=str(e))

    def list_rules(self) -> list[dict]:
        """List all registered rules."""
        return self.rule_engine.list_rules()
