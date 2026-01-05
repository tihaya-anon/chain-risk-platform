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
    
    try:
        # Try to load from training_dataset (preferred)
        data = loader.load_training_data()
        print(f"  Loaded training dataset: {len(data)} records")
    except Exception as e:
        print(f"  Could not load training_dataset: {e}")
        print("  Falling back to separate features + labels loading...")
        # Fallback: load features and labels separately and merge
        features_df = loader.load_features()
        labels_df = loader.load_labels()
        data = features_df.merge(
            labels_df[["address", "label_type"]],
            on="address",
            how="left",
        )
        # Create label column
        data["label"] = data["label_type"].apply(
            lambda x: 1 if x in ("sanctioned", "mixer") else (0 if x == "exchange" else None)
        )

    # Filter to labeled data only
    labeled_data = data[data["label"].notna()].copy()
    print(f"  Labeled records: {len(labeled_data)}")

    if len(labeled_data) < 10:
        print("  ERROR: Not enough labeled data for training (need at least 10)")
        print("  Please run label ingestion job first: ./scripts/run-label-ingestion.sh")
        return None, None

    # Prepare features and target
    print("\n[2/5] Preparing features...")
    feature_cols = config["features"]["list"]
    
    # Check which features are available
    available_features = [f for f in feature_cols if f in labeled_data.columns]
    missing_features = [f for f in feature_cols if f not in labeled_data.columns]
    
    if missing_features:
        print(f"  Warning: Missing features: {missing_features}")
    
    X = labeled_data[available_features].fillna(0)
    y = labeled_data["label"].astype(int)

    # Handle infinite values
    X = X.replace([np.inf, -np.inf], 0)

    print(f"  Feature columns: {len(available_features)}")
    print(f"  Class distribution: {dict(y.value_counts())}")

    # Check class balance
    if len(y.unique()) < 2:
        print("  ERROR: Need at least 2 classes for training")
        return None, None

    # Split data
    print("\n[3/5] Splitting data...")
    train_cfg = config["training"]
    
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=train_cfg["test_size"],
            random_state=train_cfg["random_state"],
            stratify=y,
        )
    except ValueError as e:
        print(f"  Warning: Could not stratify split ({e}), using regular split")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=train_cfg["test_size"],
            random_state=train_cfg["random_state"],
        )
    
    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

    # Train model
    print("\n[4/5] Training XGBoost...")
    model_params = config["models"]["supervised"]["params"].copy()
    
    # Remove early_stopping_rounds from params (handled separately)
    early_stopping = model_params.pop("early_stopping_rounds", None)
    
    model = XGBClassifier(**model_params)

    # Cross-validation (if enough data)
    if len(X_train) >= 20:
        cv_folds = min(train_cfg["cv_folds"], len(X_train) // 4)
        if cv_folds >= 2:
            cv_scores = cross_val_score(
                model, X_train, y_train,
                cv=cv_folds,
                scoring="roc_auc",
            )
            print(f"  CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        else:
            cv_scores = np.array([0.5])
    else:
        cv_scores = np.array([0.5])
        print("  Skipping CV (not enough data)")

    # Fit on full training set
    if early_stopping and len(X_test) > 0:
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )
    else:
        model.fit(X_train, y_train)

    # Evaluate
    print("\n[5/5] Evaluating...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "auc": roc_auc_score(y_test, y_prob) if len(y_test.unique()) > 1 else 0.5,
        "cv_auc_mean": float(cv_scores.mean()),
        "cv_auc_std": float(cv_scores.std()),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
    }

    print(f"\n  Metrics:")
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"    {k}: {v:.4f}")
        else:
            print(f"    {k}: {v}")

    if len(y_test) >= 10:
        print(f"\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=["Normal", "Risky"]))

    # Feature importance
    print(f"\n  Top 10 Feature Importance:")
    importance = dict(zip(available_features, model.feature_importances_))
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
        try:
            registry = ModelRegistry(config_path)
            registry.upload_model(
                model=model,
                model_name="xgboost",
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
