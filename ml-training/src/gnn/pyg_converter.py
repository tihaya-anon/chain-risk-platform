"""PyTorch Geometric data converter."""

import logging
from typing import Optional

import numpy as np

from .graph_builder import GraphData
from .data_utils import DataUtils, FEATURE_COLUMNS_V1

log = logging.getLogger(__name__)


def graph_data_to_pyg(
    graph_data: GraphData,
    feature_cols: Optional[list[str]] = None,
    normalize: bool = True,
    normalize_method: str = "standard",
    train_ratio: float = 0.6,
    val_ratio: float = 0.2,
    test_ratio: float = 0.2,
    stratified: bool = True,
    random_state: int = 42,
):
    """
    Convert GraphData to PyTorch Geometric Data object.

    Args:
        graph_data: GraphData object from GraphBuilder
        feature_cols: Feature columns to use (default: V1 features)
        normalize: Whether to normalize features
        normalize_method: Normalization method ('standard' or 'minmax')
        train_ratio: Training set ratio
        val_ratio: Validation set ratio
        test_ratio: Test set ratio
        stratified: Use stratified split
        random_state: Random seed

    Returns:
        PyG Data object with x, edge_index, y, train_mask, val_mask, test_mask
    """
    try:
        import torch
        from torch_geometric.data import Data
    except ImportError:
        raise ImportError("torch and torch_geometric are required for PyG conversion")

    if feature_cols is None:
        feature_cols = FEATURE_COLUMNS_V1

    nodes_df = graph_data.nodes.copy()
    edges_df = graph_data.edges.copy()

    # Normalize features
    norm_params = None
    if normalize:
        nodes_df, norm_params = DataUtils.normalize_features(
            nodes_df, feature_cols, method=normalize_method
        )

    # Extract feature matrix
    x = DataUtils.get_feature_matrix(nodes_df, feature_cols)
    x = torch.tensor(x, dtype=torch.float32)

    # Build edge index
    edge_index = DataUtils.get_edge_index(edges_df, graph_data.node_to_idx)
    edge_index = torch.tensor(edge_index, dtype=torch.long)

    # Get labels
    labels = DataUtils.get_labels_array(nodes_df, graph_data.node_labels)
    y = torch.tensor(labels, dtype=torch.float32)

    # Create masks
    if stratified:
        train_mask, val_mask, test_mask = DataUtils.create_stratified_masks(
            num_nodes=len(nodes_df),
            labels=labels,
            train_ratio=train_ratio,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
            random_state=random_state,
        )
    else:
        train_mask, val_mask, test_mask = DataUtils.create_node_masks(
            num_nodes=len(nodes_df),
            labels=labels,
            train_ratio=train_ratio,
            val_ratio=val_ratio,
            test_ratio=test_ratio,
            random_state=random_state,
        )

    train_mask = torch.tensor(train_mask, dtype=torch.bool)
    val_mask = torch.tensor(val_mask, dtype=torch.bool)
    test_mask = torch.tensor(test_mask, dtype=torch.bool)

    # Create PyG Data object
    data = Data(
        x=x,
        edge_index=edge_index,
        y=y,
        train_mask=train_mask,
        val_mask=val_mask,
        test_mask=test_mask,
    )

    # Store metadata
    data.num_features = x.shape[1]
    data.num_classes = 2
    data.node_to_idx = graph_data.node_to_idx
    data.idx_to_node = graph_data.idx_to_node
    data.norm_params = norm_params
    data.feature_cols = feature_cols

    log.info(
        f"Created PyG Data: {data.num_nodes} nodes, {data.num_edges} edges, "
        f"{data.num_features} features"
    )

    return data


def create_neighbor_sampler(
    data,
    num_neighbors: list[int],
    batch_size: int = 512,
):
    """
    Create neighbor sampler for mini-batch training.

    Args:
        data: PyG Data object
        num_neighbors: Number of neighbors to sample per layer
        batch_size: Batch size

    Returns:
        NeighborLoader for training
    """
    try:
        from torch_geometric.loader import NeighborLoader
    except ImportError:
        raise ImportError("torch_geometric is required")

    # Get training node indices
    train_idx = data.train_mask.nonzero(as_tuple=True)[0]

    loader = NeighborLoader(
        data,
        num_neighbors=num_neighbors,
        batch_size=batch_size,
        input_nodes=train_idx,
        shuffle=True,
    )

    return loader


def extract_subgraph(
    data,
    center_nodes: list[int],
    num_hops: int = 2,
):
    """
    Extract k-hop subgraph around center nodes.

    Args:
        data: PyG Data object
        center_nodes: List of center node indices
        num_hops: Number of hops

    Returns:
        Subgraph Data object
    """
    try:
        import torch
        from torch_geometric.utils import k_hop_subgraph
    except ImportError:
        raise ImportError("torch_geometric is required")

    center_idx = torch.tensor(center_nodes, dtype=torch.long)

    subset, edge_index, mapping, edge_mask = k_hop_subgraph(
        center_idx,
        num_hops=num_hops,
        edge_index=data.edge_index,
        relabel_nodes=True,
    )

    from torch_geometric.data import Data

    subgraph = Data(
        x=data.x[subset],
        edge_index=edge_index,
        y=data.y[subset] if data.y is not None else None,
    )

    subgraph.original_idx = subset
    subgraph.center_idx = mapping

    return subgraph
