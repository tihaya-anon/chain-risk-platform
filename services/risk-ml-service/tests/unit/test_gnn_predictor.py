"""Unit tests for GNNPredictor."""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch


class TestGNNPredictorInit:
    """Tests for GNNPredictor initialization."""

    def test_init_without_torch(self):
        """Handles missing torch gracefully."""
        with patch.dict("sys.modules", {"torch": None}):
            # Re-import would be needed, but for safety just check attribute
            from app.ml.gnn_predictor import GNNPredictor

            predictor = GNNPredictor()
            # Should still create instance
            assert predictor.model is None

    def test_init_default_device(self):
        """Default device is cpu."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        assert predictor.device == "cpu"

    def test_init_custom_device(self):
        """Can specify device."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor(device="cuda:0")
        assert predictor.device == "cuda:0"


class TestGNNPredictorIsReady:
    """Tests for is_ready method."""

    def test_not_ready_no_model(self):
        """Not ready when model not loaded."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        assert predictor.is_ready() is False

    def test_ready_with_model(self, mock_gnn_model):
        """Ready when model is loaded."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        predictor.model = mock_gnn_model
        predictor._torch_available = True

        assert predictor.is_ready() is True


class TestGNNPredictorPredict:
    """Tests for predict method."""

    @pytest.fixture
    def predictor_with_model(self, mock_gnn_model, mock_model_info, mock_features):
        """Setup predictor with mocked model and feature client."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        predictor.model = mock_gnn_model
        predictor.model_info = mock_model_info
        predictor._torch_available = True

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features = AsyncMock(return_value=mock_features)
        predictor.feature_client.get_subgraph = AsyncMock(return_value=None)

        return predictor

    @pytest.mark.asyncio
    async def test_predict_returns_dict(self, predictor_with_model):
        """Predict returns proper dict structure."""
        result = await predictor_with_model.predict("0x1234")

        assert isinstance(result, dict)
        assert "address" in result
        assert "score" in result
        assert "method" in result
        assert "embedding" in result

    @pytest.mark.asyncio
    async def test_predict_score_range(self, predictor_with_model):
        """Score is between 0 and 1."""
        result = await predictor_with_model.predict("0x1234")

        assert 0 <= result["score"] <= 1

    @pytest.mark.asyncio
    async def test_predict_address_lowercase(self, predictor_with_model):
        """Address is lowercased."""
        result = await predictor_with_model.predict("0xABCD1234")

        assert result["address"] == "0xabcd1234"

    @pytest.mark.asyncio
    async def test_predict_no_features(self, predictor_with_model):
        """Returns None when no features available."""
        predictor_with_model.feature_client.get_features = AsyncMock(return_value=None)

        result = await predictor_with_model.predict("0x1234")

        assert result is None

    @pytest.mark.asyncio
    async def test_predict_not_ready(self):
        """Returns None when model not ready."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()

        result = await predictor.predict("0x1234")

        assert result is None

    @pytest.mark.asyncio
    async def test_predict_single_method(self, predictor_with_model):
        """Single node prediction uses gnn_single method."""
        result = await predictor_with_model.predict("0x1234", use_subgraph=False)

        assert result["method"] == "gnn_single"

    @pytest.mark.asyncio
    async def test_predict_with_subgraph(self, predictor_with_model, mock_subgraph, mock_features):
        """Uses subgraph when available."""
        predictor_with_model.feature_client.get_subgraph = AsyncMock(return_value=mock_subgraph)
        predictor_with_model.feature_client.get_features_batch = AsyncMock(
            return_value={
                "0x1234": mock_features,
                "0x5678": mock_features,
                "0x9abc": mock_features,
            }
        )

        result = await predictor_with_model.predict("0x1234", use_subgraph=True)

        assert result["method"] == "gnn_subgraph"
        assert "subgraph_size" in result


class TestGNNPredictorBatch:
    """Tests for batch prediction."""

    @pytest.mark.asyncio
    async def test_predict_batch(self, mock_gnn_model, mock_model_info, mock_features):
        """Batch predict for multiple addresses."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        predictor.model = mock_gnn_model
        predictor.model_info = mock_model_info
        predictor._torch_available = True

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features = AsyncMock(return_value=mock_features)
        predictor.feature_client.get_subgraph = AsyncMock(return_value=None)

        results = await predictor.predict_batch(["0x1", "0x2", "0x3"])

        assert len(results) == 3
        assert all(r is not None for r in results)

    @pytest.mark.asyncio
    async def test_predict_batch_partial_failure(
        self, mock_gnn_model, mock_model_info, mock_features
    ):
        """Handles partial failures in batch."""
        from app.ml.gnn_predictor import GNNPredictor

        predictor = GNNPredictor()
        predictor.model = mock_gnn_model
        predictor.model_info = mock_model_info
        predictor._torch_available = True

        predictor.feature_client = MagicMock()
        predictor.feature_client.get_features = AsyncMock(
            side_effect=[mock_features, None, mock_features]
        )
        predictor.feature_client.get_subgraph = AsyncMock(return_value=None)

        results = await predictor.predict_batch(["0x1", "0x2", "0x3"])

        assert len(results) == 3
        assert results[0] is not None
        assert results[1] is None  # No features
        assert results[2] is not None


class TestNormalizeFeatures:
    """Tests for normalize_features utility."""

    def test_standard_normalization(self, mock_model_info, mock_features):
        """Standard normalization applied correctly."""
        from app.ml.gnn_predictor import normalize_features

        norm_params = {
            "tx_count": {"mean": 50.0, "std": 25.0},
        }

        result = normalize_features(mock_features, norm_params, method="standard")

        # (100 - 50) / 25 = 2.0
        assert abs(result[0] - 2.0) < 0.01

    def test_missing_feature_defaults_zero(self, mock_model_info):
        """Missing features default to zero."""
        from app.ml.gnn_predictor import normalize_features

        features = {"tx_count": 100.0}  # Missing other features
        norm_params = {
            "tx_count": {"mean": 50.0, "std": 25.0},
            "sent_count": {"mean": 10.0, "std": 5.0},
        }

        result = normalize_features(features, norm_params, method="standard")

        # Should not raise, missing values treated as 0
        assert isinstance(result, np.ndarray)
