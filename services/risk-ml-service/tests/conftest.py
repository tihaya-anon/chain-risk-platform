"""Pytest fixtures for risk-ml-service tests."""

from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest


@pytest.fixture
def mock_model_info():
    """Create mock ModelInfo."""
    from app.ml.model_loader import ModelInfo

    return ModelInfo(
        model_name="test_model",
        version="v1",
        model_type="gnn",
        metrics={"auc": 0.9},
        norm_params={
            "tx_count": {"mean": 50.0, "std": 25.0},
            "sent_count": {"mean": 25.0, "std": 10.0},
        },
        feature_cols=["tx_count", "sent_count", "received_count"],
    )


@pytest.fixture
def mock_features():
    """Sample feature dict."""
    return {
        "tx_count": 100.0,
        "sent_count": 50.0,
        "received_count": 50.0,
        "unique_counterparties": 10.0,
        "avg_tx_value": 1.5,
        "max_tx_value": 10.0,
        "tx_value_stddev": 2.0,
        "address_age_days": 365.0,
        "sent_ratio": 0.5,
        "round_amount_ratio": 0.1,
        "small_tx_ratio": 0.3,
        "large_tx_ratio": 0.1,
        "in_degree": 5,
        "out_degree": 5,
        "in_out_ratio": 1.0,
        "unique_in_neighbors": 5,
    }


@pytest.fixture
def mock_subgraph():
    """Sample subgraph data."""
    return {
        "nodes": [
            {"address": "0x1234", "network": "ethereum"},
            {"address": "0x5678", "network": "ethereum"},
            {"address": "0x9abc", "network": "ethereum"},
        ],
        "edges": [
            {"source": "0x1234", "target": "0x5678"},
            {"source": "0x5678", "target": "0x9abc"},
        ],
    }


class MockGNNModel:
    """Mock GNN model for testing."""

    def __init__(self):
        self.training = False

    def __call__(self, x, edge_index):
        """Return mock logits."""
        import torch

        num_nodes = x.shape[0]
        return torch.randn(num_nodes, 2)

    def get_embeddings(self, x, edge_index):
        """Return mock embeddings."""
        import torch

        num_nodes = x.shape[0]
        return torch.randn(num_nodes, 32)

    def to(self, device):
        return self

    def eval(self):
        self.training = False
        return self


class MockXGBModel:
    """Mock XGBoost model for testing."""

    def predict_proba(self, X):
        """Return mock probabilities."""
        n_samples = X.shape[0]
        probs = np.random.rand(n_samples, 2)
        probs = probs / probs.sum(axis=1, keepdims=True)
        return probs


@pytest.fixture
def mock_gnn_model():
    """Create mock GNN model."""
    return MockGNNModel()


@pytest.fixture
def mock_xgb_model():
    """Create mock XGBoost model."""
    return MockXGBModel()
