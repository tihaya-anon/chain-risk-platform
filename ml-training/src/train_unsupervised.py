#!/usr/bin/env python3
"""
Unsupervised Learning Training - Isolation Forest for Anomaly Detection

Trains an Isolation Forest model on address features for detecting anomalous addresses.
Unlike supervised learning, this doesn't require labels but can use them for evaluation.
"""

import argparse
import pickle
from pathlib import Path

import numpy as np
import yaml
from sklearn.ensemble import IsolationForest
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

from data_loader import DataLoader
from log_config import setup_logging, get_logger

log = get_logger("train_unsupervised")

FEATURE_COLS = [
    "tx_count", "sent_count", "received_count",
    "unique_counterparties", "unique_tokens",
    "total_value_sent", "total_value_received", "avg_tx_value",
    "max_tx_value", "min_tx_value", "time_span_days",
    "active_days", "avg_daily_tx", "self_transfer_count",
    "erc20_count", "native_count"
]


def train_isolation_forest(config_path: str, version: str = "v1", upload: bool = False):
    log.info("=" * 50)
    log.info("Isolation Forest Training Pipeline")
    log.info("=" * 50)

    loader = DataLoader(config_path)

    log.info("[1/4] Loading data")
    data = loader.load_training_data()
    log.info(f"Total records: {len(data)}")

    log.info("[2/4] Preparing features")
    features = [col for col in FEATURE_COLS if col in data.columns]
    X = data[features].fillna(0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    log.info(f"Features: {len(features)}, Samples: {len(X)}")

    log.info("[3/4] Training Isolation Forest")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.1,
        max_samples="auto",
        random_state=42,
        n_jobs=-1
    )

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

    model_dir = Path("models")
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / f"isolation_forest_{version}.pkl"

    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "scaler": scaler,
            "feature_cols": features,
            "metrics": metrics,
            "version": version
        }, f)

    log.info(f"Saved to {model_path}")
    log.info("Training complete")

    return metrics


def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest model")
    parser.add_argument(
        "--config",
        default="configs/training_config.yaml",
        help="Path to training config"
    )
    parser.add_argument(
        "--version",
        default="v1",
        help="Model version"
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload model to MLflow (not implemented)"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level"
    )
    args = parser.parse_args()

    setup_logging("ml-training", args.log_level, "logs")
    train_isolation_forest(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
