"""Unsupervised learning training script (Isolation Forest)."""

import argparse
from pathlib import Path

import numpy as np
import yaml
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    classification_report,
)

from data_loader import DataLoader
from model_registry import ModelRegistry


def train_isolation_forest(config_path: str, version: str, upload: bool = False):
    """Train Isolation Forest for anomaly detection.
    
    Note: Isolation Forest is unsupervised, but if labels are available,
    we use them for evaluation only (not training).
    
    Args:
        config_path: Path to training config YAML
        version: Model version string (e.g., 'v1')
        upload: Whether to upload model to MinIO
    """
    with open(config_path) as f:
        config = yaml.safe_load(f)

    print("=" * 60)
    print("Isolation Forest Training Pipeline")
    print("=" * 60)

    # Load data
    print("\n[1/4] Loading data...")
    loader = DataLoader(config_path)
    features_df = loader.load_features()

    print(f"  Features: {len(features_df)} addresses")

    # Prepare features
    print("\n[2/4] Preparing features...")
    feature_cols = config["features"]["list"]
    X = features_df[feature_cols].fillna(0)

    # Handle infinite values
    X = X.replace([np.inf, -np.inf], 0)

    print(f"  Feature columns: {len(feature_cols)}")
    print(f"  Samples: {len(X)}")

    # Train model
    print("\n[3/4] Training Isolation Forest...")
    model_params = config["models"]["unsupervised"]["params"]
    model = IsolationForest(**model_params)
    model.fit(X)

    # Get anomaly scores
    # -1 for anomalies, 1 for normal
    predictions = model.predict(X)
    scores = model.decision_function(X)

    # Convert to 0/1 (1 = anomaly = risky)
    anomaly_labels = (predictions == -1).astype(int)

    anomaly_count = anomaly_labels.sum()
    anomaly_ratio = anomaly_count / len(X)
    print(f"  Anomalies detected: {anomaly_count} ({anomaly_ratio:.2%})")

    # Score distribution
    print(f"\n  Anomaly Score Distribution:")
    print(f"    Min: {scores.min():.4f}")
    print(f"    Max: {scores.max():.4f}")
    print(f"    Mean: {scores.mean():.4f}")
    print(f"    Std: {scores.std():.4f}")

    # Evaluate with labels if available
    print("\n[4/4] Evaluating...")
    metrics = {
        "anomaly_count": int(anomaly_count),
        "anomaly_ratio": anomaly_ratio,
        "score_mean": float(scores.mean()),
        "score_std": float(scores.std()),
    }

    labels_df = loader.load_labels()
    if len(labels_df) > 0:
        print("  Labels available, computing supervised metrics...")

        # Merge with labels
        eval_df = features_df[["address"]].copy()
        eval_df["predicted"] = anomaly_labels
        eval_df = eval_df.merge(
            labels_df[["address", "label"]],
            on="address",
            how="inner",
        )

        if len(eval_df) > 0:
            y_true = eval_df["label"]
            y_pred = eval_df["predicted"]

            metrics["eval_samples"] = len(eval_df)
            metrics["precision"] = precision_score(y_true, y_pred, zero_division=0)
            metrics["recall"] = recall_score(y_true, y_pred, zero_division=0)
            metrics["f1"] = f1_score(y_true, y_pred, zero_division=0)

            print(f"\n  Evaluation on {len(eval_df)} labeled samples:")
            print(f"    Precision: {metrics['precision']:.4f}")
            print(f"    Recall: {metrics['recall']:.4f}")
            print(f"    F1: {metrics['f1']:.4f}")

            print(f"\n  Classification Report:")
            print(classification_report(
                y_true, y_pred,
                target_names=["Normal", "Anomaly"],
            ))
    else:
        print("  No labels available, skipping supervised evaluation.")

    # Save locally
    output_dir = Path(config["output"]["models_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    import joblib
    local_path = output_dir / f"isolation_forest_{version}.pkl"
    joblib.dump(model, local_path)
    print(f"\n  Saved to: {local_path}")

    # Upload to MinIO
    if upload:
        print("\n  Uploading to MinIO...")
        registry = ModelRegistry(config_path)
        registry.upload_model(
            model=model,
            model_name="isolation_forest",
            version=version,
            metrics=metrics,
            features=feature_cols,
            hyperparameters=model_params,
        )

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)

    return model, metrics


def main():
    parser = argparse.ArgumentParser(description="Train Isolation Forest anomaly detector")
    parser.add_argument(
        "--config", "-c",
        default="configs/training_config.yaml",
        help="Path to training config",
    )
    parser.add_argument(
        "--version", "-v",
        default="v1",
        help="Model version (e.g., v1, v2)",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload model to MinIO",
    )
    args = parser.parse_args()

    train_isolation_forest(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
