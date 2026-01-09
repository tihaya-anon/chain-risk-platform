"""Ensemble predictor combining GNN, XGBoost, and rule engine."""

import logging
from typing import Optional

from .gnn_predictor import GNNPredictor
from .xgb_predictor import XGBPredictor

log = logging.getLogger(__name__)


class EnsemblePredictor:
    """
    Ensemble predictor combining multiple models.

    Strategies:
    - weighted_avg: Weighted average of scores
    - max: Maximum score (conservative)
    - voting: Majority voting with threshold
    """

    def __init__(
        self,
        strategy: str = "weighted_avg",
        weights: Optional[dict] = None,
        device: str = "cpu",
    ):
        self.strategy = strategy
        self.weights = weights or {
            "gnn": 0.4,
            "xgboost": 0.4,
            "rules": 0.2,
        }
        self.device = device

        self.gnn_predictor: Optional[GNNPredictor] = None
        self.xgb_predictor: Optional[XGBPredictor] = None
        self._initialized = False

    async def initialize(
        self,
        load_gnn: bool = True,
        load_xgb: bool = True,
        gnn_model: str = "gnn_sage",
        xgb_model: str = "xgboost",
    ):
        """Initialize and load models."""
        if load_gnn:
            try:
                self.gnn_predictor = GNNPredictor(device=self.device)
                await self.gnn_predictor.load_model(gnn_model)
                log.info("GNN predictor initialized")
            except Exception as e:
                log.warning(f"Failed to load GNN model: {e}")
                self.gnn_predictor = None

        if load_xgb:
            try:
                self.xgb_predictor = XGBPredictor()
                await self.xgb_predictor.load_model(xgb_model)
                log.info("XGBoost predictor initialized")
            except Exception as e:
                log.warning(f"Failed to load XGBoost model: {e}")
                self.xgb_predictor = None

        self._initialized = True
        log.info(f"Ensemble predictor initialized with strategy: {self.strategy}")

    def is_ready(self) -> bool:
        """Check if at least one ML model is ready."""
        gnn_ready = self.gnn_predictor is not None and self.gnn_predictor.is_ready()
        xgb_ready = self.xgb_predictor is not None and self.xgb_predictor.is_ready()
        return gnn_ready or xgb_ready

    async def predict(
        self,
        address: str,
        network: str = "ethereum",
        rule_score: Optional[float] = None,
        include_details: bool = False,
    ) -> dict:
        """
        Predict risk score using ensemble.

        Args:
            address: Ethereum address
            network: Network name
            rule_score: Score from rule engine (optional)
            include_details: Include per-model scores

        Returns:
            Prediction dict with ensemble score
        """
        scores = {}
        details = {}

        # GNN prediction
        if self.gnn_predictor and self.gnn_predictor.is_ready():
            gnn_result = await self.gnn_predictor.predict(address, network)
            if gnn_result:
                scores["gnn"] = gnn_result["score"]
                details["gnn"] = gnn_result

        # XGBoost prediction
        if self.xgb_predictor and self.xgb_predictor.is_ready():
            xgb_result = await self.xgb_predictor.predict(address, network)
            if xgb_result:
                scores["xgboost"] = xgb_result["score"]
                details["xgboost"] = xgb_result

        # Rule score
        if rule_score is not None:
            scores["rules"] = rule_score
            details["rules"] = {"score": rule_score, "method": "rules"}

        if not scores:
            log.warning(f"No scores available for {address}")
            return {
                "address": address,
                "score": rule_score if rule_score is not None else 0.5,
                "method": "fallback",
            }

        # Ensemble
        ensemble_score = self._combine_scores(scores)

        result = {
            "address": address,
            "score": ensemble_score,
            "method": f"ensemble_{self.strategy}",
            "models_used": list(scores.keys()),
        }

        if include_details:
            result["details"] = details

        return result

    def _combine_scores(self, scores: dict[str, float]) -> float:
        """Combine scores using configured strategy."""
        if self.strategy == "weighted_avg":
            total_weight = 0.0
            weighted_sum = 0.0

            for model, score in scores.items():
                weight = self.weights.get(model, 0.0)
                weighted_sum += score * weight
                total_weight += weight

            if total_weight > 0:
                return weighted_sum / total_weight
            return sum(scores.values()) / len(scores)

        elif self.strategy == "max":
            return max(scores.values())

        elif self.strategy == "min":
            return min(scores.values())

        elif self.strategy == "avg":
            return sum(scores.values()) / len(scores)

        elif self.strategy == "voting":
            threshold = 0.5
            votes = sum(1 for s in scores.values() if s >= threshold)
            return 1.0 if votes > len(scores) / 2 else 0.0

        else:
            log.warning(f"Unknown strategy: {self.strategy}, using average")
            return sum(scores.values()) / len(scores)

    async def predict_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
        rule_scores: Optional[dict[str, float]] = None,
    ) -> list[dict]:
        """Predict for multiple addresses."""
        results = []
        rule_scores = rule_scores or {}

        for addr in addresses:
            result = await self.predict(
                addr, network, rule_scores.get(addr.lower())
            )
            results.append(result)

        return results

    def close(self):
        """Cleanup resources."""
        if self.gnn_predictor:
            self.gnn_predictor.close()
        if self.xgb_predictor:
            self.xgb_predictor.close()
