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
    from src.gnn import GraphBuilder, graph_data_to_pyg, GNNTrainer
    from src.gnn.models import create_gnn_model
    from src.gnn.graph_builder import FEATURE_COLUMNS

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

    # Step 2: Check available features
    log.info("\n[Step 2] Checking features...")
    available_features = [col for col in FEATURE_COLUMNS if col in graph_data.nodes.columns]
    log.info(f"  Available features: {len(available_features)}/{len(FEATURE_COLUMNS)}")
    log.info(f"  Features: {available_features}")

    if len(available_features) < 5:
        log.warning("Few features available. Adding synthetic features for testing.")
        for col in FEATURE_COLUMNS:
            if col not in graph_data.nodes.columns:
                graph_data.nodes[col] = np.random.randn(graph_data.num_nodes) * 0.1
        available_features = FEATURE_COLUMNS

    # Step 3: Check labels
    log.info("\n[Step 3] Checking labels...")
    if graph_data.node_labels is not None and len(graph_data.node_labels) > 0:
        log.info(f"  Found {len(graph_data.node_labels)} labels")
        label_dist = graph_data.node_labels["label"].value_counts()
        log.info(f"  Distribution: {dict(label_dist)}")
    else:
        log.warning("No labels found. Generating synthetic labels.")
        graph_data.node_labels = graph_data.nodes[["address"]].copy()
        graph_data.node_labels["label"] = np.random.choice(
            [0, 1], size=graph_data.num_nodes, p=[0.8, 0.2]
        )

    # Step 4: Convert to PyG format
    log.info("\n[Step 4] Converting to PyTorch Geometric format...")
    pyg_data = graph_data_to_pyg(
        graph_data,
        feature_cols=available_features,
        normalize=True,
        train_ratio=0.6,
        val_ratio=0.2,
        test_ratio=0.2,
        stratified=True,
    )

    log.info(f"  x shape: {pyg_data.x.shape}")
    log.info(f"  edge_index shape: {pyg_data.edge_index.shape}")
    log.info(f"  y shape: {pyg_data.y.shape}")
    log.info(f"  Train nodes: {pyg_data.train_mask.sum().item()}")
    log.info(f"  Val nodes: {pyg_data.val_mask.sum().item()}")
    log.info(f"  Test nodes: {pyg_data.test_mask.sum().item()}")

    # Step 5: Create model
    log.info("\n[Step 5] Creating GNN model...")
    in_channels = pyg_data.x.shape[1]
    hidden_channels = 64
    out_channels = 2

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
    log.info(f"  Architecture: {in_channels} -> {hidden_channels} -> {out_channels}")

    # Step 6: Train
    log.info("\n[Step 6] Training...")
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
        epochs=100,
        patience=20,
        verbose=True,
    )

    # Step 7: Evaluate
    log.info("\n[Step 7] Final Evaluation...")
    test_metrics = trainer.evaluate(pyg_data, "test_mask")
    log.info(f"  Test Loss: {test_metrics['loss']:.4f}")
    log.info(f"  Test Accuracy: {test_metrics['accuracy']:.4f}")
    log.info(f"  Test AUC: {test_metrics['auc']:.4f}")

    # Step 8: Save model
    log.info("\n[Step 8] Saving model...")
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
