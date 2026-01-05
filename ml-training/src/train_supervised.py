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
from log_config import setup_logging, get_logger

log = get_logger("train_supervised")


def train_xgboost(config_path: str, version: str, upload: bool = False):
    """Train XGBoost model for risk classification."""
    with open(config_path) as f:
        config = yaml.safe_load(f)

    log.info("=" * 50)
    log.info("XGBoost Training Pipeline")
    log.info("=" * 50)

    # Load data
    log.info("[1/5] Loading data")
    loader = DataLoader(config_path)
    
    try:
        data = loader.load_training_data()
    except Exception as e:
        log.warning(f"Could not load training_dataset: {e}")
        log.info("Falling back to separate features + labels")
        features_df = loader.load_features()
        labels_df = loader.load_labels()
        data = features_df.merge(labels_df[["address", "label_type"]], on="address", how="left")
        data["label"] = data["label_type"].apply(
            lambda x: 1 if x in ("sanctioned", "mixer") else (0 if x == "exchange" else None)
        )

    labeled_data = data[data["label"].notna()].copy()
    log.info(f"Total records: {len(data)}, Labeled: {len(labeled_data)}")

    if len(labeled_data) < 10:
        log.error("Not enough labeled data (need >= 10)")
        return None, None

    # Prepare features
    log.info("[2/5] Preparing features")
    feature_cols = config["features"]["list"]
    available_features = [f for f in feature_cols if f in labeled_data.columns]
    missing_features = [f for f in feature_cols if f not in labeled_data.columns]
    
    if missing_features:
        log.warning(f"Missing features: {missing_features}")
    
    X = labeled_data[available_features].fillna(0).replace([np.inf, -np.inf], 0)
    y = labeled_data["label"].astype(int)

    log.info(f"Features: {len(available_features)}, Class dist: {dict(y.value_counts())}")

    if len(y.unique()) < 2:
        log.error("Need at least 2 classes")
        return None, None

    # Split data
    log.info("[3/5] Splitting data")
    train_cfg = config["training"]
    
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=train_cfg["test_size"],
            random_state=train_cfg["random_state"],
            stratify=y,
        )
    except ValueError as e:
        log.warning(f"Could not stratify: {e}")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=train_cfg["test_size"],
            random_state=train_cfg["random_state"],
        )
    
    log.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Train
    log.info("[4/5] Training XGBoost")
    model_params = config["models"]["supervised"]["params"].copy()
    early_stopping = model_params.pop("early_stopping_rounds", None)
    model = XGBClassifier(**model_params)

    # Cross-validation
    if len(X_train) >= 20:
        cv_folds = min(train_cfg["cv_folds"], len(X_train) // 4)
        if cv_folds >= 2:
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv_folds, scoring="roc_auc")
            log.info(f"CV AUC: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        else:
            cv_scores = np.array([0.5])
    else:
        cv_scores = np.array([0.5])
        log.debug("Skipping CV (insufficient data)")

    if early_stopping and len(X_test) > 0:
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    else:
        model.fit(X_train, y_train)

    # Evaluate
    log.info("[5/5] Evaluating")
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

    for k, v in metrics.items():
        log.info(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")

    if len(y_test) >= 10:
        log.debug(f"\n{classification_report(y_test, y_pred, target_names=['Normal', 'Risky'])}")

    # Feature importance
    importance = sorted(zip(available_features, model.feature_importances_), key=lambda x: -x[1])
    log.info("Top 5 features: " + ", ".join(f"{f}={i:.3f}" for f, i in importance[:5]))

    # Save
    output_dir = Path(config["output"]["models_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    import joblib
    local_path = output_dir / f"xgboost_{version}.pkl"
    joblib.dump(model, local_path)
    log.info(f"Saved to {local_path}")

    if upload:
        try:
            registry = ModelRegistry(config_path)
            registry.upload_model(model, "xgboost", version, metrics, available_features, model_params)
        except Exception as e:
            log.error(f"MinIO upload failed: {e}")

    log.info("Training complete")
    return model, metrics


def main():
    parser = argparse.ArgumentParser(description="Train XGBoost risk model")
    parser.add_argument("--config", "-c", default="configs/training_config.yaml")
    parser.add_argument("--version", "-v", default="v1")
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()

    setup_logging("ml-training", args.log_level, "logs")
    train_xgboost(args.config, args.version, args.upload)


if __name__ == "__main__":
    main()
