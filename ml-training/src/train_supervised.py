"""Supervised learning training script (XGBoost)."""

import argparse
from pathlib import Path

import numpy as np
import yaml
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
)
from xgboost import XGBClassifier

from data_loader import DataLoader
from model_registry import ModelRegistry


def train_xgboost(config_path: str, version: str, upload: bool = False):
    """Train XGBoost model for risk classification.
    
    Args:
        config_path: Path to training config YAML
        version: Model version string (e.g., 'v1')
        upload: Whether to upload model to MinIO
    """
    with open(config_path) as f:
        config = yaml.safe_load(f)

    print("=" * 60)
    print("XGBoost Training Pipeline")
    print("=" * 60)

    # Load data
    print("\n[1/5] Loading data...")
    loader = DataLoader(config_path)
    features_df = loader.load_features()
    labels_df = loader.load_labels()

    print(f"  Features: {len(features_df)} addresses")
    print(f"  Labels: {len(labels_df)} addresses")

    # Merge features and labels
    data = loader.merge_features_labels(features_df, labels_df)
    print(f"  Merged: {len(data)} samples")

    if len(data) < 100:
        print("  WARNING: Very few samples. Consider adding more labeled data.")

    # Prepare features and target
    print("\n[2/5] Preparing features...")
    feature_cols = config["features"]["list"]
    X = data[feature_cols].fillna(0)
    y = data["label"]

    # Handle infinite values
    X = X.replace([np.inf, -np.inf], 0)

    print(f"  Feature columns: {len(feature_cols)}")
    print(f"  Class distribution: {dict(y.value_counts())}")

    # Split data
    print("\n[3/5] Splitting data...")
    train_cfg = config["training"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=train_cfg["test_size"],
        random_state=train_cfg["random_state"],
        stratify=y,
    )
    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

    # Train model
    print("\n[4/5] Training XGBoost...")
    model_params = config["models"]["supervised"]["params"]
    model = XGBClassifier(**model_params)

    # Cross-validation
    cv_scores = cross_val_score(
        model, X_train, y_train,
        cv=train_cfg["cv_folds"],
        scoring="roc_auc",
    )
    print(f"  CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

    # Fit on full training set
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Evaluate
    print("\n[5/5] Evaluating...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "auc": roc_auc_score(y_test, y_prob),
        "cv_auc_mean": cv_scores.mean(),
        "cv_auc_std": cv_scores.std(),
    }

    print(f"\n  Metrics:")
    for k, v in metrics.items():
        print(f"    {k}: {v:.4f}")

    print(f"\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Risky"]))

    # Feature importance
    print(f"\n  Top 10 Feature Importance:")
    importance = dict(zip(feature_cols, model.feature_importances_))
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1])[:10]:
        print(f"    {feat}: {imp:.4f}")

    # Save locally
    output_dir = Path(config["output"]["models_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    import joblib
    local_path = output_dir / f"xgboost_{version}.pkl"
    joblib.dump(model, local_path)
    print(f"\n  Saved to: {local_path}")

    # Upload to MinIO
    if upload:
        print("\n  Uploading to MinIO...")
        registry = ModelRegistry(config_path)
        registry.upload_model(
            model=model,
            model_name="xgboost",
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
    parser = argparse.ArgumentParser(description="Train XGBoost risk model")
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

    train_xgboost(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
