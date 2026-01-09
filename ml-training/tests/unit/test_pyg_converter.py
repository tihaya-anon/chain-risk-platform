"""Unit tests for PyG data converter."""

import numpy as np
import pandas as pd
import pytest
import torch


class TestGraphDataToPyg:
    """Tests for graph_data_to_pyg function."""

    def test_basic_conversion(self, sample_graph_data):
        """Basic conversion produces valid PyG Data."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data, normalize=False)

        assert hasattr(data, "x")
        assert hasattr(data, "edge_index")
        assert hasattr(data, "y")
        assert hasattr(data, "train_mask")
        assert hasattr(data, "val_mask")
        assert hasattr(data, "test_mask")

    def test_feature_shape(self, sample_graph_data):
        """Feature matrix has correct shape."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data)

        assert data.x.shape[0] == 10
        assert data.x.shape[1] == 16
        assert data.num_features == 16

    def test_edge_index_shape(self, sample_graph_data):
        """Edge index has shape (2, num_edges)."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data)

        assert data.edge_index.shape[0] == 2
        assert data.edge_index.dtype == torch.long

    def test_labels_aligned(self, sample_graph_data):
        """Labels are aligned with nodes."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data)

        assert data.y.shape[0] == 10

        labeled_count = (~torch.isnan(data.y)).sum().item()
        assert labeled_count == 6

    def test_mask_split_ratios(self, sample_graph_data):
        """Train/val/test masks respect split ratios."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(
            sample_graph_data,
            train_ratio=0.5,
            val_ratio=0.25,
            test_ratio=0.25,
        )

        total_masked = (
            data.train_mask.sum() + data.val_mask.sum() + data.test_mask.sum()
        )
        assert total_masked.item() <= 6

        overlap = data.train_mask & data.val_mask
        assert overlap.sum() == 0

    def test_normalization_applied(self, sample_graph_data):
        """Features are normalized when requested."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data, normalize=True)

        assert data.x.abs().max() < 100

    def test_metadata_stored(self, sample_graph_data):
        """Metadata is stored on Data object."""
        from src.gnn.pyg_converter import graph_data_to_pyg

        data = graph_data_to_pyg(sample_graph_data)

        assert data.num_classes == 2
        assert hasattr(data, "node_to_idx")
        assert hasattr(data, "idx_to_node")
        assert hasattr(data, "feature_cols")

    def test_empty_graph(self):
        """Handles empty graph."""
        from src.gnn.graph_builder import GraphData
        from src.gnn.pyg_converter import graph_data_to_pyg

        empty_graph = GraphData(
            nodes=pd.DataFrame(columns=["address"]),
            edges=pd.DataFrame(columns=["source", "target", "weight"]),
        )

        data = graph_data_to_pyg(empty_graph)

        assert data.x.shape[0] == 0
        assert data.edge_index.shape[1] == 0


class TestExtractSubgraph:
    """Tests for extract_subgraph function."""

    def test_subgraph_extraction(self, sample_pyg_data):
        """Extracts valid subgraph."""
        from src.gnn.pyg_converter import extract_subgraph

        subgraph = extract_subgraph(
            sample_pyg_data,
            center_nodes=[0],
            num_hops=2,
        )

        assert hasattr(subgraph, "x")
        assert hasattr(subgraph, "edge_index")
        assert hasattr(subgraph, "original_idx")
        assert hasattr(subgraph, "center_idx")

    def test_subgraph_contains_center(self, sample_pyg_data):
        """Subgraph contains center node."""
        from src.gnn.pyg_converter import extract_subgraph

        subgraph = extract_subgraph(
            sample_pyg_data,
            center_nodes=[0],
            num_hops=1,
        )

        assert len(subgraph.center_idx) == 1
        assert subgraph.center_idx[0] < subgraph.x.shape[0]


class TestDataUtils:
    """Tests for DataUtils class."""

    def test_normalize_standard(self):
        """Standard normalization produces zero mean, unit variance."""
        from src.gnn.data_utils import DataUtils

        df = pd.DataFrame({
            "address": ["a", "b", "c"],
            "feat1": [10.0, 20.0, 30.0],
            "feat2": [100.0, 200.0, 300.0],
        })

        normalized, params = DataUtils.normalize_features(
            df, ["feat1", "feat2"], method="standard"
        )

        assert abs(normalized["feat1"].mean()) < 0.1
        assert abs(normalized["feat1"].std() - 1.0) < 0.1

        assert "feat1" in params
        assert "mean" in params["feat1"]

    def test_normalize_minmax(self):
        """MinMax normalization produces [0, 1] range."""
        from src.gnn.data_utils import DataUtils

        df = pd.DataFrame({
            "address": ["a", "b", "c"],
            "feat1": [10.0, 20.0, 30.0],
        })

        normalized, params = DataUtils.normalize_features(
            df, ["feat1"], method="minmax"
        )

        assert normalized["feat1"].min() == 0.0
        assert normalized["feat1"].max() == 1.0

    def test_apply_normalization(self):
        """Can apply saved normalization params."""
        from src.gnn.data_utils import DataUtils

        df = pd.DataFrame({"feat1": [10.0, 20.0, 30.0]})
        _, params = DataUtils.normalize_features(df, ["feat1"], method="standard")

        new_df = pd.DataFrame({"feat1": [25.0]})
        normalized = DataUtils.apply_normalization(new_df, params, method="standard")

        assert normalized["feat1"].iloc[0] > 0

    def test_create_node_masks(self):
        """Creates valid train/val/test masks."""
        from src.gnn.data_utils import DataUtils

        labels = np.array([0, 1, 0, 1, np.nan, np.nan])

        train, val, test = DataUtils.create_node_masks(
            num_nodes=6,
            labels=labels,
            train_ratio=0.5,
            val_ratio=0.25,
            test_ratio=0.25,
        )

        assert train[4] == False
        assert train[5] == False

        assert not (train & val).any()
        assert not (train & test).any()
        assert not (val & test).any()

    def test_get_feature_matrix(self):
        """Extracts feature matrix correctly."""
        from src.gnn.data_utils import DataUtils

        df = pd.DataFrame({
            "address": ["a", "b"],
            "feat1": [1.0, 2.0],
            "feat2": [3.0, 4.0],
        })

        X = DataUtils.get_feature_matrix(df, ["feat1", "feat2"])

        assert X.shape == (2, 2)
        assert X.dtype == np.float32

    def test_get_feature_matrix_missing_cols(self):
        """Handles missing feature columns."""
        from src.gnn.data_utils import DataUtils

        df = pd.DataFrame({
            "address": ["a", "b"],
            "feat1": [1.0, 2.0],
        })

        X = DataUtils.get_feature_matrix(df, ["feat1", "feat2", "feat3"])

        assert X.shape == (2, 3)
        assert X[0, 1] == 0.0
        assert X[0, 2] == 0.0

    def test_get_edge_index(self):
        """Converts edges to index array."""
        from src.gnn.data_utils import DataUtils

        edges_df = pd.DataFrame({
            "source": ["a", "b"],
            "target": ["b", "c"],
        })
        node_to_idx = {"a": 0, "b": 1, "c": 2}

        edge_index = DataUtils.get_edge_index(edges_df, node_to_idx)

        assert edge_index.shape == (2, 2)
        assert edge_index[0, 0] == 0
        assert edge_index[1, 0] == 1

    def test_compute_class_weights(self):
        """Computes class weights for imbalanced data."""
        from src.gnn.data_utils import DataUtils

        labels = np.array([0, 0, 0, 0, 1])

        weights = DataUtils.compute_class_weights(labels)

        assert 0 in weights
        assert 1 in weights
        assert weights[1] > weights[0]
