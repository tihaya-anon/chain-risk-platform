#!/usr/bin/env python3
"""Unsupervised Learning Training - Isolation Forest for Anomaly Detection."""

import argparse
import pickle
from pathlib import Path

import numpy as np
import yaml
from sklearn.ensemble import IsolationForest
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

from data_loader import DataLoader
from model_registry import ModelRegistry
from log_config import setup_logging, get_logger

log = get_logger("train_unsupervised")


def train_isolation_forest(config_path: str, version: str = "v1", upload: bool = False):
    """Train Isolation Forest model for anomaly detection."""
    with open(config_path) as f:
        config = yaml.safe_load(f)

    log.info("=" * 50)
    log.info("Isolation Forest Training Pipeline")
    log.info("=" * 50)

    loader = DataLoader(config_path)

    # Load data
    log.info("[1/4] Loading data")
    try:
        data = loader.load_training_data()
    except Exception as e:
        log.warning(f"Could not load training_dataset: {e}")
        data = loader.load_features()

    log.info(f"Total records: {len(data)}")

    # Prepare features
    log.info("[2/4] Preparing features")
    feature_cols = config["features"]["list"]
    available_features = [col for col in feature_cols if col in data.columns]

    if not available_features:
        log.error("No features available")
        return None

    X = data[available_features].fillna(0).replace([np.inf, -np.inf], 0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    log.info(f"Features: {len(available_features)}, Samples: {len(X)}")

    # Train
    log.info("[3/4] Training Isolation Forest")
    model_params = config["models"]["unsupervised"]["params"]
    model = IsolationForest(**model_params)
    model.fit(X_scaled)

    scores = model.decision_function(X_scaled)
    predictions = model.predict(X_scaled)
    anomaly_labels = (predictions == -1).astype(int)

    n_anomalies = anomaly_labels.sum()
    anomaly_ratio = n_anomalies / len(anomaly_labels)
    log.info(f"Anomalies: {n_anomalies} ({anomaly_ratio:.2%})")
    log.info(f"Score stats: min={scores.min():.4f}, max={scores.max():.4f}, mean={scores.mean():.4f}")

    metrics = {
        "anomalies_detected": int(n_anomalies),
        "anomaly_ratio": float(anomaly_ratio),
        "score_mean": float(scores.mean()),
        "score_std": float(scores.std()),
        "total_samples": len(X),
    }

    # Evaluate with labels if available
    log.info("[4/4] Evaluating")
    if "label" in data.columns:
        labeled_mask = data["label"].notna()

        if labeled_mask.sum() > 0:
            log.info(f"Evaluating on {labeled_mask.sum()} labeled samples")
            y_true = data.loc[labeled_mask, "label"].astype(int).values
            y_pred = anomaly_labels[labeled_mask.values]

            if len(y_true) == len(y_pred):
                metrics["eval_samples"] = len(y_true)
                metrics["precision"] = float(precision_score(y_true, y_pred, zero_division=0))
                metrics["recall"] = float(recall_score(y_true, y_pred, zero_division=0))
                metrics["f1"] = float(f1_score(y_true, y_pred, zero_division=0))

                log.info(f"  precision: {metrics['precision']:.4f}")
                log.info(f"  recall: {metrics['recall']:.4f}")
                log.info(f"  f1: {metrics['f1']:.4f}")

    # Save locally
    model_dir = Path(config["output"]["models_dir"])
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / f"isolation_forest_{version}.pkl"

    model_data = {
        "model": model,
        "scaler": scaler,
        "feature_cols": available_features,
        "metrics": metrics,
        "version": version,
    }

    with open(model_path, "wb") as f:
        pickle.dump(model_data, f)
    log.info(f"Saved to {model_path}")

    # Upload to MinIO
    if upload:
        try:
            registry = ModelRegistry(config_path)
            registry.upload_isolation_forest(
                model=model,
                scaler=scaler,
                version=version,
                metrics=metrics,
                features=available_features,
                hyperparameters=model_params,
            )
        except Exception as e:
            log.error(f"MinIO upload failed: {e}")

    log.info("Training complete")
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest model")
    parser.add_argument("--config", "-c", default="configs/training_config.yaml")
    parser.add_argument("--version", "-v", default="v1")
    parser.add_argument("--upload", action="store_true", help="Upload to MinIO")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    setup_logging("ml-training", args.log_level, "logs")
    train_isolation_forest(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
