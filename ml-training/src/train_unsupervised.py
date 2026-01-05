"""Unsupervised learning training script (Isolation Forest)."""

import argparse
from pathlib import Path

import numpy as np
import yaml
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score, f1_score, classification_report

from data_loader import DataLoader
from model_registry import ModelRegistry
from log_config import setup_logging, get_logger

log = get_logger("train_unsupervised")


def train_isolation_forest(config_path: str, version: str, upload: bool = False):
    """Train Isolation Forest for anomaly detection."""
    with open(config_path) as f:
        config = yaml.safe_load(f)

    log.info("=" * 50)
    log.info("Isolation Forest Training Pipeline")
    log.info("=" * 50)

    # Load data
    log.info("[1/4] Loading data")
    loader = DataLoader(config_path)
    
    try:
        data = loader.load_training_data()
    except Exception as e:
        log.warning(f"Could not load training_dataset: {e}")
        data = loader.load_features()
        data["label"] = None

    log.info(f"Total records: {len(data)}")

    if len(data) < 10:
        log.error("Not enough data (need >= 10)")
        return None, None

    # Prepare features
    log.info("[2/4] Preparing features")
    feature_cols = config["features"]["list"]
    available_features = [f for f in feature_cols if f in data.columns]
    missing_features = [f for f in feature_cols if f not in data.columns]
    
    if missing_features:
        log.warning(f"Missing features: {missing_features}")
    
    X = data[available_features].fillna(0).replace([np.inf, -np.inf], 0)
    log.info(f"Features: {len(available_features)}, Samples: {len(X)}")

    # Train
    log.info("[3/4] Training Isolation Forest")
    model_params = config["models"]["unsupervised"]["params"]
    model = IsolationForest(**model_params)
    model.fit(X)

    predictions = model.predict(X)
    scores = model.decision_function(X)
    anomaly_labels = (predictions == -1).astype(int)

    anomaly_count = anomaly_labels.sum()
    anomaly_ratio = anomaly_count / len(X)
    log.info(f"Anomalies: {anomaly_count} ({anomaly_ratio:.2%})")
    log.info(f"Score stats: min={scores.min():.4f}, max={scores.max():.4f}, mean={scores.mean():.4f}")

    # Evaluate
    log.info("[4/4] Evaluating")
    metrics = {
        "anomaly_count": int(anomaly_count),
        "anomaly_ratio": float(anomaly_ratio),
        "score_mean": float(scores.mean()),
        "score_std": float(scores.std()),
        "total_samples": len(X),
    }

    if "label" in data.columns:
        labeled_data = data[data["label"].notna()].copy()
        
        if len(labeled_data) > 0:
            log.info(f"Evaluating on {len(labeled_data)} labeled samples")
            labeled_indices = labeled_data.index
            y_true = labeled_data["label"].astype(int).values
            y_pred = anomaly_labels[data.index.isin(labeled_indices)].values

            if len(y_true) == len(y_pred):
                metrics["eval_samples"] = len(y_true)
                metrics["precision"] = float(precision_score(y_true, y_pred, zero_division=0))
                metrics["recall"] = float(recall_score(y_true, y_pred, zero_division=0))
                metrics["f1"] = float(f1_score(y_true, y_pred, zero_division=0))

                log.info(f"  precision: {metrics['precision']:.4f}")
                log.info(f"  recall: {metrics['recall']:.4f}")
                log.info(f"  f1: {metrics['f1']:.4f}")

                if len(y_true) >= 10:
                    log.debug(f"\n{classification_report(y_true, y_pred, target_names=['Normal', 'Anomaly'], zero_division=0)}")

    # Save
    output_dir = Path(config["output"]["models_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    import joblib
    local_path = output_dir / f"isolation_forest_{version}.pkl"
    joblib.dump(model, local_path)
    log.info(f"Saved to {local_path}")

    # Save scores
    data["anomaly_score"] = scores
    data["is_anomaly"] = anomaly_labels
    scores_path = output_dir / f"anomaly_scores_{version}.parquet"
    data[["address", "anomaly_score", "is_anomaly"]].to_parquet(scores_path, index=False)
    log.info(f"Saved scores to {scores_path}")

    if upload:
        try:
            registry = ModelRegistry(config_path)
            registry.upload_model(model, "isolation_forest", version, metrics, available_features, model_params)
        except Exception as e:
            log.error(f"MinIO upload failed: {e}")

    log.info("Training complete")
    return model, metrics


def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest")
    parser.add_argument("--config", "-c", default="configs/training_config.yaml")
    parser.add_argument("--version", "-v", default="v1")
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    setup_logging("ml-training", args.log_level, "logs")
    train_isolation_forest(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
