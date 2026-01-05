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
    
    try:
        # Load training dataset (includes all addresses, labeled or not)
        data = loader.load_training_data()
        print(f"  Loaded training dataset: {len(data)} records")
    except Exception as e:
        print(f"  Could not load training_dataset: {e}")
        print("  Falling back to features only...")
        data = loader.load_features()
        data["label"] = None

    print(f"  Total records: {len(data)}")

    if len(data) < 10:
        print("  ERROR: Not enough data for training")
        return None, None

    # Prepare features
    print("\n[2/4] Preparing features...")
    feature_cols = config["features"]["list"]
    
    # Check which features are available
    available_features = [f for f in feature_cols if f in data.columns]
    missing_features = [f for f in feature_cols if f not in data.columns]
    
    if missing_features:
        print(f"  Warning: Missing features: {missing_features}")
    
    X = data[available_features].fillna(0)

    # Handle infinite values
    X = X.replace([np.inf, -np.inf], 0)

    print(f"  Feature columns: {len(available_features)}")
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
        "anomaly_ratio": float(anomaly_ratio),
        "score_mean": float(scores.mean()),
        "score_std": float(scores.std()),
        "total_samples": len(X),
    }

    # Check if we have labels for evaluation
    if "label" in data.columns:
        labeled_data = data[data["label"].notna()].copy()
        
        if len(labeled_data) > 0:
            print(f"  Labels available, computing supervised metrics...")

            # Get predictions for labeled data
            labeled_indices = labeled_data.index
            y_true = labeled_data["label"].astype(int).values
            y_pred = anomaly_labels[data.index.isin(labeled_indices)].values

            if len(y_true) == len(y_pred) and len(y_true) > 0:
                metrics["eval_samples"] = len(y_true)
                metrics["precision"] = float(precision_score(y_true, y_pred, zero_division=0))
                metrics["recall"] = float(recall_score(y_true, y_pred, zero_division=0))
                metrics["f1"] = float(f1_score(y_true, y_pred, zero_division=0))

                print(f"\n  Evaluation on {len(y_true)} labeled samples:")
                print(f"    Precision: {metrics['precision']:.4f}")
                print(f"    Recall: {metrics['recall']:.4f}")
                print(f"    F1: {metrics['f1']:.4f}")

                if len(y_true) >= 10:
                    print(f"\n  Classification Report:")
                    print(classification_report(
                        y_true, y_pred,
                        target_names=["Normal", "Anomaly"],
                        zero_division=0,
                    ))
            else:
                print("  Could not align predictions with labels")
        else:
            print("  No labels available, skipping supervised evaluation.")
    else:
        print("  No label column, skipping supervised evaluation.")

    # Save locally
    output_dir = Path(config["output"]["models_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    import joblib
    local_path = output_dir / f"isolation_forest_{version}.pkl"
    joblib.dump(model, local_path)
    print(f"\n  Saved to: {local_path}")

    # Also save the anomaly scores for reference
    data["anomaly_score"] = scores
    data["is_anomaly"] = anomaly_labels
    scores_path = output_dir / f"anomaly_scores_{version}.parquet"
    data[["address", "anomaly_score", "is_anomaly"]].to_parquet(scores_path, index=False)
    print(f"  Saved anomaly scores to: {scores_path}")

    # Upload to MinIO
    if upload:
        print("\n  Uploading to MinIO...")
        try:
            registry = ModelRegistry(config_path)
            registry.upload_model(
                model=model,
                model_name="isolation_forest",
                version=version,
                metrics=metrics,
                features=available_features,
                hyperparameters=model_params,
            )
        except Exception as e:
            print(f"  Warning: Could not upload to MinIO: {e}")

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
