#!/usr/bin/env python
"""GNN training entry point."""

import argparse
import logging
import sys
from pathlib import Path

import yaml

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from log_config import setup_logging, get_logger

log = get_logger("train_gnn")


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file."""
    with open(config_path) as f:
        return yaml.safe_load(f)


def build_graph_data(config: dict):
    """Build graph data from configured sources."""
    from gnn.graph_builder import GraphBuilder, GraphData

    data_config = config["data"]
    graph_config = config["graph"]

    if data_config["source"] == "parquet":
        log.info("Loading graph from parquet files")
        graph_dir = data_config["parquet"]["graph_dir"]
        return GraphBuilder.load_from_files(graph_dir)

    elif data_config["source"] == "neo4j":
        log.info("Building graph from Neo4j and Trino")
        neo4j_config = data_config["neo4j"]
        trino_config = data_config["trino"]

        builder = GraphBuilder(
            neo4j_uri=neo4j_config["uri"],
            neo4j_user=neo4j_config["user"],
            neo4j_password=neo4j_config["password"],
            trino_host=trino_config["host"],
            trino_port=trino_config["port"],
            trino_user=trino_config["user"],
            trino_catalog=trino_config["catalog"],
            trino_schema=trino_config["schema"],
        )

        try:
            graph_data = builder.build_graph_data(
                network=graph_config["network"],
                limit=graph_config.get("limit"),
                min_tx_count=graph_config.get("min_tx_count", 1),
                feature_version=graph_config.get("feature_version", "v1"),
                include_labels=True,
            )
        finally:
            builder.close()

        return graph_data

    else:
        raise ValueError(f"Unknown data source: {data_config['source']}")


def train_gnn(config_path: str, version: str, upload: bool = False):
    """Main training function."""
    import torch

    from gnn.pyg_converter import graph_data_to_pyg
    from gnn.models import create_gnn_model
    from gnn.trainer import GNNTrainer
    from gnn.evaluate import evaluate_model, print_evaluation_report
    from gnn.data_utils import DataUtils
    from model_registry import ModelRegistry

    config = load_config(config_path)

    log.info("=" * 50)
    log.info("GNN Training Pipeline")
    log.info("=" * 50)

    # Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info(f"Using device: {device}")

    # Build graph data
    log.info("[1/5] Building graph data")
    graph_data = build_graph_data(config)

    # Convert to PyG format
    log.info("[2/5] Converting to PyG format")
    feature_config = config["features"]
    training_config = config["training"]

    data = graph_data_to_pyg(
        graph_data,
        feature_cols=feature_config.get("columns"),
        normalize=feature_config.get("normalize", True),
        normalize_method=feature_config.get("normalize_method", "standard"),
        train_ratio=training_config["train_ratio"],
        val_ratio=training_config["val_ratio"],
        test_ratio=training_config["test_ratio"],
        stratified=training_config.get("stratified", True),
        random_state=training_config.get("random_state", 42),
    )

    log.info(f"Graph: {data.num_nodes} nodes, {data.num_edges} edges")

    # Create model
    log.info("[3/5] Creating model")
    model_config = config["model"]
    model_type = model_config["type"]

    model_kwargs = model_config.get(model_type, {})
    model = create_gnn_model(
        model_type=model_type,
        in_channels=data.num_features,
        hidden_channels=model_config["hidden_dim"],
        out_channels=data.num_classes,
        num_layers=model_config["num_layers"],
        dropout=model_config["dropout"],
        **model_kwargs,
    )

    log.info(f"Model: {model_type.upper()}, params: {sum(p.numel() for p in model.parameters())}")

    # Setup training
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=training_config["lr"],
        weight_decay=training_config["weight_decay"],
    )

    # Class weights for imbalanced data
    if training_config.get("use_class_weights", True):
        labels = data.y[data.train_mask].numpy()
        valid_labels = labels[~np.isnan(labels)]
        if len(valid_labels) > 0:
            class_weights = DataUtils.compute_class_weights(valid_labels)
            weight_tensor = torch.tensor(
                [class_weights.get(i, 1.0) for i in range(data.num_classes)],
                dtype=torch.float32,
                device=device,
            )
            criterion = torch.nn.CrossEntropyLoss(weight=weight_tensor)
        else:
            criterion = torch.nn.CrossEntropyLoss()
    else:
        criterion = torch.nn.CrossEntropyLoss()

    # Train
    log.info("[4/5] Training")
    trainer = GNNTrainer(
        model=model,
        optimizer=optimizer,
        criterion=criterion,
        device=device,
    )

    output_config = config["output"]
    metrics = trainer.train(
        data,
        epochs=training_config["epochs"],
        patience=training_config["patience"],
        min_delta=training_config.get("min_delta", 0.001),
        checkpoint_dir=output_config.get("checkpoints_dir"),
        verbose=True,
    )

    # Evaluate
    log.info("[5/5] Evaluating")
    test_metrics = evaluate_model(model, data, device)
    print_evaluation_report(test_metrics, "Test Set Results")

    # Save model
    models_dir = Path(output_config["models_dir"])
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / f"gnn_{model_type}_{version}.pt"
    torch.save(
        {
            "model_type": model_type,
            "model_config": model_config,
            "model_state_dict": model.state_dict(),
            "feature_cols": data.feature_cols,
            "norm_params": data.norm_params,
            "metrics": test_metrics,
            "training_metrics": {
                "best_epoch": metrics.best_epoch,
                "best_val_auc": metrics.best_val_auc,
                "training_time": metrics.training_time,
            },
        },
        model_path,
    )
    log.info(f"Saved model to {model_path}")

    # Upload to registry
    if upload:
        try:
            registry = ModelRegistry(config_path)
            registry.upload_gnn_model(
                model_path=str(model_path),
                model_type=model_type,
                version=version,
                metrics=test_metrics,
                feature_cols=data.feature_cols,
                model_config=model_config,
            )
            log.info("Uploaded model to MinIO registry")
        except Exception as e:
            log.error(f"Failed to upload model: {e}")

    log.info("Training complete")
    return model, test_metrics


def main():
    parser = argparse.ArgumentParser(description="Train GNN risk model")
    parser.add_argument("--config", "-c", default="configs/gnn_config.yaml")
    parser.add_argument("--version", "-v", default="v1")
    parser.add_argument("--upload", action="store_true", help="Upload to MinIO registry")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    setup_logging("gnn-training", args.log_level, "logs")

    import numpy as np  # noqa: F401 - used in train_gnn

    train_gnn(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
