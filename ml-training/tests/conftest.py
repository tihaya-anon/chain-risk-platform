"""Pytest fixtures for GNN tests."""

import numpy as np
import pandas as pd
import pytest
import torch


@pytest.fixture
def sample_graph_data():
    """Create sample GraphData for testing."""
    from src.gnn.graph_builder import GraphData

    nodes_df = pd.DataFrame({
        "address": [f"0x{i:040x}" for i in range(10)],
        "network": "ethereum",
        "tx_count": np.random.randint(1, 100, 10),
        "sent_count": np.random.randint(0, 50, 10),
        "received_count": np.random.randint(0, 50, 10),
        "unique_counterparties": np.random.randint(1, 20, 10),
        "avg_tx_value": np.random.rand(10) * 10,
        "max_tx_value": np.random.rand(10) * 100,
        "tx_value_stddev": np.random.rand(10) * 5,
        "address_age_days": np.random.randint(1, 365, 10),
        "sent_ratio": np.random.rand(10),
        "round_amount_ratio": np.random.rand(10),
        "small_tx_ratio": np.random.rand(10),
        "large_tx_ratio": np.random.rand(10),
        "in_degree": np.random.randint(0, 10, 10),
        "out_degree": np.random.randint(0, 10, 10),
        "in_out_ratio": np.random.rand(10),
        "unique_in_neighbors": np.random.randint(0, 10, 10),
    })

    # Create edges (random connections)
    edges = []
    for _ in range(20):
        src = np.random.randint(0, 10)
        tgt = np.random.randint(0, 10)
        if src != tgt:
            edges.append({
                "source": f"0x{src:040x}",
                "target": f"0x{tgt:040x}",
                "weight": np.random.rand(),
            })
    edges_df = pd.DataFrame(edges)

    # Labels: first 3 high-risk, rest low-risk
    labels_df = pd.DataFrame({
        "address": [f"0x{i:040x}" for i in range(6)],
        "label": [1, 1, 1, 0, 0, 0],
    })

    return GraphData(nodes=nodes_df, edges=edges_df, node_labels=labels_df)


@pytest.fixture
def sample_pyg_data(sample_graph_data):
    """Create sample PyG Data for testing."""
    from src.gnn.pyg_converter import graph_data_to_pyg

    return graph_data_to_pyg(
        sample_graph_data,
        normalize=True,
        train_ratio=0.5,
        val_ratio=0.25,
        test_ratio=0.25,
    )


@pytest.fixture
def simple_pyg_data():
    """Create minimal PyG Data for quick tests."""
    from torch_geometric.data import Data

    num_nodes = 20
    num_features = 16
    num_edges = 40

    x = torch.randn(num_nodes, num_features)
    edge_index = torch.randint(0, num_nodes, (2, num_edges))
    y = torch.zeros(num_nodes)
    y[:num_nodes // 2] = torch.nan  # Half unlabeled
    y[num_nodes // 2:] = torch.randint(0, 2, (num_nodes // 2,)).float()

    # Masks
    labeled_idx = torch.arange(num_nodes // 2, num_nodes)
    train_mask = torch.zeros(num_nodes, dtype=torch.bool)
    val_mask = torch.zeros(num_nodes, dtype=torch.bool)
    test_mask = torch.zeros(num_nodes, dtype=torch.bool)

    n_labeled = len(labeled_idx)
    train_mask[labeled_idx[:int(n_labeled * 0.6)]] = True
    val_mask[labeled_idx[int(n_labeled * 0.6):int(n_labeled * 0.8)]] = True
    test_mask[labeled_idx[int(n_labeled * 0.8):]] = True

    return Data(
        x=x,
        edge_index=edge_index,
        y=y,
        train_mask=train_mask,
        val_mask=val_mask,
        test_mask=test_mask,
    )


@pytest.fixture
def device():
    """Get compute device."""
    return "cuda" if torch.cuda.is_available() else "cpu"
