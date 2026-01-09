"""Unit tests for EnsemblePredictor."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestEnsembleCombineScores:
    """Tests for score combination strategies."""

    def test_weighted_avg_equal_weights(self):
        """Weighted average with equal weights."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(
            strategy="weighted_avg",
            weights={"gnn": 0.5, "xgboost": 0.5},
        )

        score = predictor._combine_scores({"gnn": 0.8, "xgboost": 0.6})

        assert abs(score - 0.7) < 0.01

    def test_weighted_avg_unequal_weights(self):
        """Weighted average with different weights."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(
            strategy="weighted_avg",
            weights={"gnn": 0.6, "xgboost": 0.2, "rules": 0.2},
        )

        scores = {"gnn": 1.0, "xgboost": 0.0, "rules": 0.0}
        score = predictor._combine_scores(scores)

        # (1.0*0.6 + 0*0.2 + 0*0.2) / 1.0 = 0.6
        assert abs(score - 0.6) < 0.01

    def test_weighted_avg_partial_scores(self):
        """Weighted average with only some models available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(
            strategy="weighted_avg",
            weights={"gnn": 0.4, "xgboost": 0.4, "rules": 0.2},
        )

        # Only GNN and rules available
        scores = {"gnn": 0.8, "rules": 0.5}
        score = predictor._combine_scores(scores)

        # (0.8*0.4 + 0.5*0.2) / (0.4 + 0.2) = 0.42 / 0.6 = 0.7
        assert abs(score - 0.7) < 0.01

    def test_max_strategy(self):
        """Max strategy returns highest score."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="max")

        score = predictor._combine_scores({"gnn": 0.3, "xgboost": 0.9, "rules": 0.5})

        assert score == 0.9

    def test_min_strategy(self):
        """Min strategy returns lowest score."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="min")

        score = predictor._combine_scores({"gnn": 0.3, "xgboost": 0.9, "rules": 0.5})

        assert score == 0.3

    def test_avg_strategy(self):
        """Avg strategy returns simple average."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="avg")

        score = predictor._combine_scores({"gnn": 0.3, "xgboost": 0.6, "rules": 0.9})

        assert abs(score - 0.6) < 0.01

    def test_voting_majority_high(self):
        """Voting returns 1.0 when majority above threshold."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="voting")

        # 2 out of 3 above 0.5
        score = predictor._combine_scores({"gnn": 0.7, "xgboost": 0.6, "rules": 0.3})

        assert score == 1.0

    def test_voting_majority_low(self):
        """Voting returns 0.0 when majority below threshold."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="voting")

        # 2 out of 3 below 0.5
        score = predictor._combine_scores({"gnn": 0.3, "xgboost": 0.4, "rules": 0.8})

        assert score == 0.0

    def test_unknown_strategy_fallback(self):
        """Unknown strategy falls back to average."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="unknown_strategy")

        score = predictor._combine_scores({"gnn": 0.4, "xgboost": 0.6})

        assert abs(score - 0.5) < 0.01


class TestEnsemblePredict:
    """Tests for ensemble predict method."""

    @pytest.mark.asyncio
    async def test_predict_with_all_models(self, mock_gnn_model, mock_xgb_model, mock_model_info):
        """Predict with all models available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="weighted_avg")

        # Mock GNN predictor
        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.gnn_predictor.predict = AsyncMock(
            return_value={"address": "0x1234", "score": 0.8, "method": "gnn"}
        )

        # Mock XGB predictor
        predictor.xgb_predictor = MagicMock()
        predictor.xgb_predictor.is_ready.return_value = True
        predictor.xgb_predictor.predict = AsyncMock(
            return_value={"address": "0x1234", "score": 0.6, "method": "xgboost"}
        )

        result = await predictor.predict("0x1234", rule_score=0.5)

        assert "score" in result
        assert "method" in result
        assert result["method"] == "ensemble_weighted_avg"
        assert "models_used" in result
        assert set(result["models_used"]) == {"gnn", "xgboost", "rules"}

    @pytest.mark.asyncio
    async def test_predict_gnn_only(self):
        """Predict when only GNN available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor(strategy="weighted_avg")

        # Mock GNN predictor
        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.gnn_predictor.predict = AsyncMock(
            return_value={"address": "0x1234", "score": 0.8, "method": "gnn"}
        )

        # No XGB
        predictor.xgb_predictor = None

        result = await predictor.predict("0x1234")

        assert result["score"] == 0.8
        assert result["models_used"] == ["gnn"]

    @pytest.mark.asyncio
    async def test_predict_no_models_fallback(self):
        """Fallback when no models available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()
        predictor.gnn_predictor = None
        predictor.xgb_predictor = None

        result = await predictor.predict("0x1234", rule_score=0.7)

        assert result["score"] == 0.7
        assert result["method"] == "fallback"

    @pytest.mark.asyncio
    async def test_predict_include_details(self):
        """Include per-model details when requested."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()

        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.gnn_predictor.predict = AsyncMock(
            return_value={"address": "0x1234", "score": 0.8, "method": "gnn", "embedding": [0.1]}
        )
        predictor.xgb_predictor = None

        result = await predictor.predict("0x1234", include_details=True)

        assert "details" in result
        assert "gnn" in result["details"]
        assert result["details"]["gnn"]["embedding"] == [0.1]

    @pytest.mark.asyncio
    async def test_predict_model_returns_none(self):
        """Handle model returning None gracefully."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()

        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.gnn_predictor.predict = AsyncMock(return_value=None)

        predictor.xgb_predictor = MagicMock()
        predictor.xgb_predictor.is_ready.return_value = True
        predictor.xgb_predictor.predict = AsyncMock(
            return_value={"address": "0x1234", "score": 0.6, "method": "xgboost"}
        )

        result = await predictor.predict("0x1234")

        assert result["models_used"] == ["xgboost"]


class TestEnsembleIsReady:
    """Tests for is_ready method."""

    def test_ready_with_gnn(self):
        """Ready when GNN is available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()
        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.xgb_predictor = None

        assert predictor.is_ready() is True

    def test_ready_with_xgb(self):
        """Ready when XGB is available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()
        predictor.gnn_predictor = None
        predictor.xgb_predictor = MagicMock()
        predictor.xgb_predictor.is_ready.return_value = True

        assert predictor.is_ready() is True

    def test_not_ready_no_models(self):
        """Not ready when no models available."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()
        predictor.gnn_predictor = None
        predictor.xgb_predictor = None

        assert predictor.is_ready() is False


class TestEnsembleBatchPredict:
    """Tests for batch prediction."""

    @pytest.mark.asyncio
    async def test_predict_batch_multiple(self):
        """Batch predict for multiple addresses."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()

        predictor.gnn_predictor = MagicMock()
        predictor.gnn_predictor.is_ready.return_value = True
        predictor.gnn_predictor.predict = AsyncMock(
            side_effect=[
                {"address": "0x1", "score": 0.8, "method": "gnn"},
                {"address": "0x2", "score": 0.3, "method": "gnn"},
            ]
        )
        predictor.xgb_predictor = None

        results = await predictor.predict_batch(["0x1", "0x2"])

        assert len(results) == 2
        assert results[0]["score"] == 0.8
        assert results[1]["score"] == 0.3

    @pytest.mark.asyncio
    async def test_predict_batch_with_rule_scores(self):
        """Batch predict with rule scores."""
        from app.ml.ensemble import EnsemblePredictor

        predictor = EnsemblePredictor()
        predictor.gnn_predictor = None
        predictor.xgb_predictor = None

        rule_scores = {"0x1": 0.9, "0x2": 0.1}
        results = await predictor.predict_batch(["0x1", "0x2"], rule_scores=rule_scores)

        assert results[0]["score"] == 0.9
        assert results[1]["score"] == 0.1
