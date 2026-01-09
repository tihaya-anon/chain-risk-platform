"""GNN module for graph-based risk analysis."""

from .graph_builder import GraphBuilder, GraphData
from .data_utils import DataUtils, FEATURE_COLUMNS_V1
from .pyg_converter import graph_data_to_pyg, create_neighbor_sampler, extract_subgraph
from .trainer import GNNTrainer, TrainingMetrics, EarlyStopping
from .evaluate import (
    evaluate_node_classification,
    evaluate_model,
    get_predictions,
    find_optimal_threshold,
    print_evaluation_report,
)

__all__ = [
    # Graph building
    "GraphBuilder",
    "GraphData",
    # Data utilities
    "DataUtils",
    "FEATURE_COLUMNS_V1",
    # PyG conversion
    "graph_data_to_pyg",
    "create_neighbor_sampler",
    "extract_subgraph",
    # Training
    "GNNTrainer",
    "TrainingMetrics",
    "EarlyStopping",
    # Evaluation
    "evaluate_node_classification",
    "evaluate_model",
    "get_predictions",
    "find_optimal_threshold",
    "print_evaluation_report",
]
