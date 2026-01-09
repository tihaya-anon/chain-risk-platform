"""Unit tests for XGBPredictor."""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock


class TestXGBPredictorInit:
    """Tests for XGBPredictor initialization."""

    def test_init_defaults(self):
        """Default initialization."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        assert predictor.model is None
        assert predictor.model_info is None


class TestXGBPredictorIsReady:
    """Tests for is_ready method."""

    def test_not_ready_no_model(self):
        """Not ready when model not loaded."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        assert predictor.is_ready() is False

    def test_ready_with_model(self, mock_xgb_model, mock_model_info):
        """Ready when model is loaded."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info

        assert predictor.is_ready() is True


class TestXGBPredictorPredict:
    """Tests for predict method."""

    @pytest.fixture
    def predictor_with_model(self, mock_xgb_model, mock_model_info, mock_features):
        """Setup predictor with mocked model."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features = AsyncMock(return_value=mock_features)

        return predictor

    @pytest.mark.asyncio
    async def test_predict_returns_dict(self, predictor_with_model):
        """Predict returns proper structure."""
        result = await predictor_with_model.predict("0x1234")

        assert isinstance(result, dict)
        assert "address" in result
        assert "score" in result
        assert "method" in result
        assert result["method"] == "xgboost"

    @pytest.mark.asyncio
    async def test_predict_score_range(self, predictor_with_model):
        """Score is between 0 and 1."""
        result = await predictor_with_model.predict("0x1234")

        assert 0 <= result["score"] <= 1

    @pytest.mark.asyncio
    async def test_predict_address_lowercase(self, predictor_with_model):
        """Address is lowercased."""
        result = await predictor_with_model.predict("0xABCD")

        assert result["address"] == "0xabcd"

    @pytest.mark.asyncio
    async def test_predict_no_features(self, predictor_with_model):
        """Returns None when no features."""
        predictor_with_model.feature_client.get_features = AsyncMock(return_value=None)

        result = await predictor_with_model.predict("0x1234")

        assert result is None

    @pytest.mark.asyncio
    async def test_predict_not_ready(self):
        """Returns None when not ready."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()

        result = await predictor.predict("0x1234")

        assert result is None


class TestXGBPrepareFeatures:
    """Tests for _prepare_features method."""

    def test_prepare_features_order(self, mock_xgb_model, mock_model_info, mock_features):
        """Features are extracted in correct order."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info
        predictor.model_info.feature_cols = ["tx_count", "sent_count", "received_count"]

        result = predictor._prepare_features(mock_features)

        assert result.shape == (3,)
        assert result[0] == 100.0  # tx_count
        assert result[1] == 50.0   # sent_count
        assert result[2] == 50.0   # received_count

    def test_prepare_features_missing(self, mock_xgb_model, mock_model_info):
        """Missing features default to 0."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info
        predictor.model_info.feature_cols = ["tx_count", "missing_feat"]

        features = {"tx_count": 100.0}
        result = predictor._prepare_features(features)

        assert result[1] == 0.0

    def test_prepare_features_nan_inf(self, mock_xgb_model, mock_model_info):
        """NaN and Inf values replaced with 0."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info
        predictor.model_info.feature_cols = ["a", "b", "c"]

        features = {"a": float("nan"), "b": float("inf"), "c": 1.0}
        result = predictor._prepare_features(features)

        assert result[0] == 0.0
        assert result[1] == 0.0
        assert result[2] == 1.0


class TestXGBBatchPredict:
    """Tests for batch prediction."""

    @pytest.mark.asyncio
    async def test_predict_batch(self, mock_xgb_model, mock_model_info, mock_features):
        """Batch prediction for multiple addresses."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features_batch = AsyncMock(
            return_value={
                "0x1": mock_features,
                "0x2": mock_features,
            }
        )

        results = await predictor.predict_batch(["0x1", "0x2"])

        assert len(results) == 2
        assert all(r is not None for r in results)

    @pytest.mark.asyncio
    async def test_predict_batch_not_ready(self):
        """Returns None list when not ready."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()

        results = await predictor.predict_batch(["0x1", "0x2"])

        assert results == [None, None]

    @pytest.mark.asyncio
    async def test_predict_batch_partial_features(
        self, mock_xgb_model, mock_model_info, mock_features
    ):
        """Handles missing features in batch."""
        from app.ml.xgb_predictor import XGBPredictor

        predictor = XGBPredictor()
        predictor.model = mock_xgb_model
        predictor.model_info = mock_model_info

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features_batch = AsyncMock(
            return_value={
                "0x1": mock_features,
                # 0x2 missing
            }
        )

        results = await predictor.predict_batch(["0x1", "0x2"])

        assert results[0] is not None
        assert results[1] is None
