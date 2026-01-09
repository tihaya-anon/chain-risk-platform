#!/usr/bin/env python3
"""
Unified ML Training Pipeline - Train all models and upload to MinIO.

Usage:
    # Train all models
    uv run python src/train_all.py --version v1 --upload

    # Train specific models
    uv run python src/train_all.py --models xgboost,gnn --version v1
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from log_config import setup_logging, get_logger

log = get_logger("train_all")


def train_xgboost(config_path: str, version: str, upload: bool):
    """Train XGBoost model."""
    from train_supervised import train_xgboost as _train

    log.info("=" * 60)
    log.info("Training XGBoost")
    log.info("=" * 60)
    return _train(config_path, version, upload)


def train_isolation_forest(config_path: str, version: str, upload: bool):
    """Train Isolation Forest model."""
    from train_unsupervised import train_isolation_forest as _train

    log.info("=" * 60)
    log.info("Training Isolation Forest")
    log.info("=" * 60)
    return _train(config_path, version, upload)


def train_gnn(config_path: str, version: str, upload: bool):
    """Train GNN model."""
    import yaml
    import torch
    from gnn import GraphBuilder, graph_data_to_pyg, GNNTrainer
    from gnn.models import create_gnn_model
    from gnn.graph_builder import FEATURE_COLUMNS
    from model_registry import ModelRegistry

    log.info("=" * 60)
    log.info("Training GNN")
    log.info("=" * 60)

    # Load config for connection info
    with open(config_path) as f:
        config = yaml.safe_load(f)

    trino_cfg = config["data"]["trino"]

    # Build graph
    builder = GraphBuilder(
        neo4j_uri="bolt://localhost:17687",
        neo4j_user="neo4j",
        neo4j_password="chainrisk123",
        trino_host=trino_cfg["host"],
        trino_port=trino_cfg["port"],
    )

    try:
        graph_data = builder.build_graph_data(network="ethereum")
    finally:
        builder.close()

    if graph_data.num_nodes == 0:
        log.error("No nodes found")
        return None, None

    log.info(f"Graph: {graph_data.num_nodes} nodes, {graph_data.num_edges} edges")

    # Get available features
    available_features = [col for col in FEATURE_COLUMNS if col in graph_data.nodes.columns]
    log.info(f"Features: {len(available_features)}")

    # Convert to PyG
    pyg_data = graph_data_to_pyg(
        graph_data,
        feature_cols=available_features,
        normalize=True,
        train_ratio=0.6,
        val_ratio=0.2,
        test_ratio=0.2,
    )

    # Create model
    in_channels = pyg_data.x.shape[1]
    model = create_gnn_model(
        model_type="sage",
        in_channels=in_channels,
        hidden_channels=64,
        out_channels=2,
        num_layers=2,
        dropout=0.3,
    )

    # Train
    device = "cuda" if torch.cuda.is_available() else "cpu"
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)
    criterion = torch.nn.CrossEntropyLoss()

    trainer = GNNTrainer(model=model, optimizer=optimizer, criterion=criterion, device=device)
    metrics = trainer.train(data=pyg_data, epochs=100, patience=20, verbose=True)

    # Evaluate
    test_metrics = trainer.evaluate(pyg_data, "test_mask")
    log.info(f"Test AUC: {test_metrics['auc']:.4f}")

    # Save
    output_dir = Path("outputs/gnn")
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / f"model_{version}.pt"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "model_config": {
                "model_type": "sage",
                "in_channels": in_channels,
                "hidden_channels": 64,
                "out_channels": 2,
                "num_layers": 2,
                "dropout": 0.3,
            },
            "feature_columns": available_features,
            "metrics": {
                "best_val_auc": metrics.best_val_auc,
                "test_auc": test_metrics["auc"],
            },
        },
        model_path,
    )
    log.info(f"Saved to {model_path}")

    # Upload
    if upload:
        try:
            registry = ModelRegistry(config_path)
            registry.upload_gnn_model(
                model_path=str(model_path),
                model_type="sage",
                version=version,
                metrics={"best_val_auc": metrics.best_val_auc, "test_auc": test_metrics["auc"]},
                feature_cols=available_features,
                model_config={
                    "model_type": "sage",
                    "in_channels": in_channels,
                    "hidden_channels": 64,
                    "out_channels": 2,
                    "num_layers": 2,
                    "dropout": 0.3,
                },
            )
        except Exception as e:
            log.error(f"Upload failed: {e}")

    return model, {"best_val_auc": metrics.best_val_auc, "test_auc": test_metrics["auc"]}


def main():
    parser = argparse.ArgumentParser(description="Train all ML models")
    parser.add_argument("--config", "-c", default="configs/training_config.yaml")
    parser.add_argument("--version", "-v", default="v1")
    parser.add_argument("--upload", action="store_true", help="Upload to MinIO")
    parser.add_argument(
        "--models",
        "-m",
        default="xgboost,isolation_forest,gnn",
        help="Comma-separated list of models to train",
    )
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    setup_logging("ml-training", args.log_level, "logs")

    models = [m.strip().lower() for m in args.models.split(",")]
    results = {}

    log.info("=" * 60)
    log.info(f"ML Training Pipeline - Version {args.version}")
    log.info(f"Models: {models}")
    log.info(f"Upload: {args.upload}")
    log.info("=" * 60)

    if "xgboost" in models:
        try:
            _, metrics = train_xgboost(args.config, args.version, args.upload)
            results["xgboost"] = metrics
        except Exception as e:
            log.error(f"XGBoost training failed: {e}")
            results["xgboost"] = {"error": str(e)}

    if "isolation_forest" in models:
        try:
            metrics = train_isolation_forest(args.config, args.version, args.upload)
            results["isolation_forest"] = metrics
        except Exception as e:
            log.error(f"Isolation Forest training failed: {e}")
            results["isolation_forest"] = {"error": str(e)}

    if "gnn" in models:
        try:
            _, metrics = train_gnn(args.config, args.version, args.upload)
            results["gnn"] = metrics
        except Exception as e:
            log.error(f"GNN training failed: {e}")
            results["gnn"] = {"error": str(e)}

    # Summary
    log.info("\n" + "=" * 60)
    log.info("Training Summary")
    log.info("=" * 60)
    for model_name, metrics in results.items():
        if "error" in metrics:
            log.info(f"  {model_name}: FAILED - {metrics['error']}")
        else:
            key_metric = metrics.get("auc") or metrics.get("test_auc") or metrics.get("f1", "N/A")
            log.info(f"  {model_name}: OK (metric={key_metric})")


if __name__ == "__main__":
    main()
