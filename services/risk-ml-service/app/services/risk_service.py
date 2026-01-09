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
    """Service for computing risk scores with ML ensemble."""

    def __init__(self):
        self.config = get_config()
        self.rule_engine = RuleEngine()
        self.query_client = QueryServiceClient()
        self._redis: Optional[redis.Redis] = None
        self._ensemble = None
        self._ml_initialized = False

    async def initialize_ml(self):
        """Initialize ML models (call on startup)."""
        if not self.config.ml.enabled:
            logger.info("ML scoring disabled by config")
            return

        try:
            from app.ml import EnsemblePredictor

            ml_cfg = self.config.ml
            self._ensemble = EnsemblePredictor(
                strategy=ml_cfg.ensemble_strategy,
                weights={
                    "gnn": ml_cfg.gnn_weight,
                    "xgboost": ml_cfg.xgb_weight,
                    "rules": ml_cfg.rules_weight,
                },
                device=ml_cfg.device,
            )

            await self._ensemble.initialize(
                load_gnn=ml_cfg.gnn_enabled,
                load_xgb=ml_cfg.xgb_enabled,
                gnn_model=ml_cfg.gnn_model,
                xgb_model=ml_cfg.xgb_model,
            )

            self._ml_initialized = self._ensemble.is_ready()
            logger.info(f"ML ensemble initialized: {self._ml_initialized}")

        except Exception as e:
            logger.error(f"Failed to initialize ML models: {e}")
            self._ml_initialized = False

    def ml_ready(self) -> bool:
        """Check if ML models are ready."""
        return self._ml_initialized and self._ensemble is not None

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
        """Close connections."""
        if self._redis:
            await self._redis.close()
            self._redis = None
        if self._ensemble:
            self._ensemble.close()

    async def score_address(
        self,
        address: str,
        network: str = "ethereum",
        include_factors: bool = True,
        use_cache: bool = True,
        use_ml: bool = True,
    ) -> RiskScoreResponse:
        """
        Compute risk score for a single address.

        Args:
            address: Ethereum address
            network: Network name
            include_factors: Include risk factors in response
            use_cache: Use Redis cache
            use_ml: Use ML models (if available)

        Returns:
            RiskScoreResponse
        """
        address = address.lower()
        cache_key = f"risk:v2:{network}:{address}"

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
        rule_result = await self.rule_engine.evaluate(
            address=address,
            network=network,
            address_info=address_info,
            transfers=transfers,
            include_factors=include_factors,
        )

        # ML scoring (if enabled and ready)
        if use_ml and self.ml_ready():
            try:
                ml_result = await self._ensemble.predict(
                    address=address,
                    network=network,
                    rule_score=rule_result.score,
                    include_details=True,
                )

                # Update result with ML ensemble score
                rule_result.score = ml_result["score"]
                rule_result.risk_level = self._get_risk_level(ml_result["score"])

                # Add ML info to factors
                if include_factors:
                    rule_result.factors.append({
                        "rule": "ml_ensemble",
                        "triggered": True,
                        "score": ml_result["score"],
                        "method": ml_result["method"],
                        "models_used": ml_result.get("models_used", []),
                    })

                logger.debug(
                    f"ML scoring for {address}: {ml_result['score']:.3f} "
                    f"({ml_result['method']})"
                )

            except Exception as e:
                logger.warning(f"ML scoring failed for {address}, using rules only: {e}")

        # Cache result
        if use_cache:
            await self._set_cached(cache_key, rule_result)

        return rule_result

    def _get_risk_level(self, score: float) -> str:
        """Determine risk level from score."""
        if score >= self.config.risk.high_risk_threshold:
            return "high"
        elif score >= self.config.risk.medium_risk_threshold:
            return "medium"
        return "low"

    async def score_addresses_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
        include_factors: bool = False,
        use_ml: bool = True,
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
                    use_ml=use_ml,
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

    def get_ml_status(self) -> dict:
        """Get ML models status."""
        if not self._ensemble:
            return {"enabled": False, "reason": "ML not configured"}

        return {
            "enabled": self.config.ml.enabled,
            "ready": self.ml_ready(),
            "gnn_ready": (
                self._ensemble.gnn_predictor is not None
                and self._ensemble.gnn_predictor.is_ready()
            ),
            "xgb_ready": (
                self._ensemble.xgb_predictor is not None
                and self._ensemble.xgb_predictor.is_ready()
            ),
            "strategy": self.config.ml.ensemble_strategy,
        }
