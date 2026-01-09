#!/usr/bin/env python3
"""
Mini-batch training script for testing GNN pipeline with real data.

Usage:
    uv run python src/train_gnn_mini.py
"""

import logging
import sys
from pathlib import Path

import torch
import numpy as np

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


def main():
    log.info("=" * 60)
    log.info("GNN Mini-batch Training Test")
    log.info("=" * 60)

    # Config
    NEO4J_URI = "bolt://localhost:17687"
    NEO4J_USER = "neo4j"
    NEO4J_PASSWORD = "chainrisk123"
    TRINO_HOST = "localhost"
    TRINO_PORT = 18081
    NETWORK = "ethereum"

    # Import GNN modules
    from src.gnn import GraphBuilder, DataUtils, PyGConverter
    from src.gnn.models import create_gnn_model
    from src.gnn import GNNTrainer

    # Step 1: Load graph data
    log.info("\n[Step 1] Loading graph data...")
    builder = GraphBuilder(
        neo4j_uri=NEO4J_URI,
        neo4j_user=NEO4J_USER,
        neo4j_password=NEO4J_PASSWORD,
        trino_host=TRINO_HOST,
        trino_port=TRINO_PORT,
    )

    try:
        graph_data = builder.build_graph_data(network=NETWORK)
    finally:
        builder.close()

    log.info(f"  Nodes: {graph_data.num_nodes}")
    log.info(f"  Edges: {graph_data.num_edges}")
    log.info(f"  Labels: {len(graph_data.node_labels) if graph_data.node_labels is not None else 0}")

    if graph_data.num_nodes == 0:
        log.error("No nodes found. Check Neo4j data.")
        sys.exit(1)

    # Step 2: Prepare features
    log.info("\n[Step 2] Preparing features...")
    from src.gnn.graph_builder import FEATURE_COLUMNS

    # Check which features are available
    available_features = [col for col in FEATURE_COLUMNS if col in graph_data.nodes.columns]
    log.info(f"  Available features: {len(available_features)}/{len(FEATURE_COLUMNS)}")

    if not available_features:
        log.warning("No features available. Using random features for testing.")
        # Add random features for testing
        for i, col in enumerate(FEATURE_COLUMNS[:8]):
            graph_data.nodes[col] = np.random.randn(graph_data.num_nodes)
        available_features = FEATURE_COLUMNS[:8]

    # Normalize features
    log.info("  Normalizing features...")
    normalized_nodes, scaler = DataUtils.normalize_features(
        graph_data.nodes, feature_columns=available_features
    )
    graph_data.nodes = normalized_nodes

    # Step 3: Assign labels
    log.info("\n[Step 3] Assigning labels...")
    if graph_data.node_labels is not None and len(graph_data.node_labels) > 0:
        # Merge labels
        label_map = dict(zip(graph_data.node_labels["address"], graph_data.node_labels["label"]))
        graph_data.nodes["label"] = graph_data.nodes["address"].map(label_map)
        labeled_count = graph_data.nodes["label"].notna().sum()
        log.info(f"  Labeled nodes: {labeled_count}/{graph_data.num_nodes}")

        if labeled_count > 0:
            label_dist = graph_data.nodes["label"].value_counts()
            log.info(f"  Label distribution: {dict(label_dist)}")
    else:
        log.warning("No labels found. Generating synthetic labels for testing.")
        # Assign random labels (20% high risk)
        graph_data.nodes["label"] = np.random.choice([0, 1], size=graph_data.num_nodes, p=[0.8, 0.2])
        labeled_count = graph_data.num_nodes

    # Step 4: Convert to PyG
    log.info("\n[Step 4] Converting to PyTorch Geometric format...")
    converter = PyGConverter(feature_columns=available_features)
    pyg_data = converter.convert(graph_data)

    log.info(f"  x shape: {pyg_data.x.shape}")
    log.info(f"  edge_index shape: {pyg_data.edge_index.shape}")
    log.info(f"  y shape: {pyg_data.y.shape}")

    # Step 5: Create train/val/test masks
    log.info("\n[Step 5] Creating train/val/test splits...")
    # Get indices of labeled nodes
    labeled_mask = ~torch.isnan(pyg_data.y)
    labeled_indices = torch.where(labeled_mask)[0].numpy()
    log.info(f"  Labeled nodes: {len(labeled_indices)}")

    if len(labeled_indices) < 10:
        log.warning("Too few labeled nodes. Adding more synthetic labels.")
        pyg_data.y = torch.tensor(
            np.random.choice([0, 1], size=graph_data.num_nodes, p=[0.8, 0.2]),
            dtype=torch.float,
        )
        labeled_indices = np.arange(graph_data.num_nodes)

    # Shuffle and split
    np.random.shuffle(labeled_indices)
    n = len(labeled_indices)
    train_end = int(n * 0.6)
    val_end = int(n * 0.8)

    train_idx = labeled_indices[:train_end]
    val_idx = labeled_indices[train_end:val_end]
    test_idx = labeled_indices[val_end:]

    # Create masks
    pyg_data.train_mask = torch.zeros(graph_data.num_nodes, dtype=torch.bool)
    pyg_data.val_mask = torch.zeros(graph_data.num_nodes, dtype=torch.bool)
    pyg_data.test_mask = torch.zeros(graph_data.num_nodes, dtype=torch.bool)

    pyg_data.train_mask[train_idx] = True
    pyg_data.val_mask[val_idx] = True
    pyg_data.test_mask[test_idx] = True

    log.info(f"  Train: {pyg_data.train_mask.sum().item()}")
    log.info(f"  Val: {pyg_data.val_mask.sum().item()}")
    log.info(f"  Test: {pyg_data.test_mask.sum().item()}")

    # Step 6: Create model
    log.info("\n[Step 6] Creating GNN model...")
    in_channels = pyg_data.x.shape[1]
    hidden_channels = 64
    out_channels = 2  # Binary classification

    model = create_gnn_model(
        model_type="sage",
        in_channels=in_channels,
        hidden_channels=hidden_channels,
        out_channels=out_channels,
        num_layers=2,
        dropout=0.3,
    )

    total_params = sum(p.numel() for p in model.parameters())
    log.info(f"  Model: GraphSAGE")
    log.info(f"  Parameters: {total_params}")
    log.info(f"  Input dim: {in_channels}, Hidden dim: {hidden_channels}, Output dim: {out_channels}")

    # Step 7: Train
    log.info("\n[Step 7] Training...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info(f"  Device: {device}")

    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
    criterion = torch.nn.CrossEntropyLoss()

    trainer = GNNTrainer(
        model=model,
        optimizer=optimizer,
        criterion=criterion,
        device=device,
    )

    metrics = trainer.train(
        data=pyg_data,
        epochs=50,
        patience=10,
        verbose=True,
    )

    # Step 8: Evaluate
    log.info("\n[Step 8] Final Evaluation...")
    test_metrics = trainer.evaluate(pyg_data, "test_mask")
    log.info(f"  Test Loss: {test_metrics['loss']:.4f}")
    log.info(f"  Test Accuracy: {test_metrics['accuracy']:.4f}")
    log.info(f"  Test AUC: {test_metrics['auc']:.4f}")

    # Step 9: Save model
    log.info("\n[Step 9] Saving model...")
    output_dir = Path("outputs/gnn_mini")
    output_dir.mkdir(parents=True, exist_ok=True)

    model_path = output_dir / "model.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "model_config": {
                "model_type": "sage",
                "in_channels": in_channels,
                "hidden_channels": hidden_channels,
                "out_channels": out_channels,
                "num_layers": 2,
                "dropout": 0.3,
            },
            "feature_columns": available_features,
            "metrics": {
                "best_val_auc": metrics.best_val_auc,
                "test_auc": test_metrics["auc"],
                "test_accuracy": test_metrics["accuracy"],
            },
        },
        model_path,
    )
    log.info(f"  Saved to: {model_path}")

    # Summary
    log.info("\n" + "=" * 60)
    log.info("Training Complete!")
    log.info("=" * 60)
    log.info(f"  Best Val AUC: {metrics.best_val_auc:.4f}")
    log.info(f"  Test AUC: {test_metrics['auc']:.4f}")
    log.info(f"  Training Time: {metrics.training_time:.1f}s")


if __name__ == "__main__":
    main()
