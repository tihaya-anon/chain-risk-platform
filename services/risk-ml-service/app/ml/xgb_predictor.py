"""XGBoost predictor for tabular risk scoring."""

import logging
from typing import Optional

import numpy as np

from .model_loader import ModelLoader, ModelInfo
from .feature_client import FeatureClient, normalize_features, FEATURE_COLUMNS

log = logging.getLogger(__name__)


class XGBPredictor:
    """XGBoost-based risk predictor."""

    def __init__(self):
        self.model = None
        self.model_info: Optional[ModelInfo] = None
        self.loader = ModelLoader()
        self.feature_client = FeatureClient()

    async def load_model(self, model_name: str = "xgboost", version: str = "latest"):
        """Load XGBoost model from registry."""
        self.model, self.model_info = self.loader.download_sklearn_model(model_name, version)
        log.info(f"Loaded XGBoost model: {model_name}/{self.model_info.version}")

    def is_ready(self) -> bool:
        """Check if model is loaded."""
        return self.model is not None

    async def predict(
        self,
        address: str,
        network: str = "ethereum",
    ) -> Optional[dict]:
        """
        Predict risk score for an address.

        Args:
            address: Ethereum address
            network: Network name

        Returns:
            Prediction dict with score, or None
        """
        if not self.is_ready():
            log.warning("XGBoost model not ready")
            return None

        address = address.lower()

        # Get features
        features = await self.feature_client.get_features(address, network)
        if not features:
            log.debug(f"No features for {address}, skipping XGBoost")
            return None

        # Prepare feature array
        x = self._prepare_features(features)

        # Predict
        try:
            prob = self.model.predict_proba(x.reshape(1, -1))[0, 1]
            return {
                "address": address,
                "score": float(prob),
                "method": "xgboost",
            }
        except Exception as e:
            log.error(f"XGBoost prediction failed for {address}: {e}")
            return None

    def _prepare_features(self, features: dict) -> np.ndarray:
        """Prepare feature array from dict."""
        feature_cols = self.model_info.feature_cols or FEATURE_COLUMNS

        values = []
        for col in feature_cols:
            val = features.get(col, 0.0)
            if val is None or np.isnan(val) or np.isinf(val):
                val = 0.0
            values.append(val)

        return np.array(values, dtype=np.float32)

    async def predict_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
    ) -> list[Optional[dict]]:
        """Predict for multiple addresses."""
        if not self.is_ready():
            return [None] * len(addresses)

        # Get features in batch
        features_batch = await self.feature_client.get_features_batch(addresses, network)

        results = []
        for addr in addresses:
            addr = addr.lower()
            if addr not in features_batch:
                results.append(None)
                continue

            try:
                x = self._prepare_features(features_batch[addr])
                prob = self.model.predict_proba(x.reshape(1, -1))[0, 1]
                results.append({
                    "address": addr,
                    "score": float(prob),
                    "method": "xgboost",
                })
            except Exception as e:
                log.error(f"XGBoost prediction failed for {addr}: {e}")
                results.append(None)

        return results

    def close(self):
        """Cleanup resources."""
        self.feature_client.close()
