"""GNN model evaluation utilities."""

import logging
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)


def evaluate_node_classification(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None,
    threshold: float = 0.5,
) -> dict:
    """
    Evaluate node classification results.

    Args:
        y_true: True labels
        y_pred: Predicted labels (or probabilities if y_prob is None)
        y_prob: Prediction probabilities for positive class
        threshold: Classification threshold

    Returns:
        Dictionary of metrics
    """
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
        confusion_matrix,
        classification_report,
    )

    # Handle probabilities
    if y_prob is None and y_pred.ndim == 1 and y_pred.dtype == np.float64:
        y_prob = y_pred
        y_pred = (y_prob >= threshold).astype(int)

    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
    }

    # AUC requires probabilities
    if y_prob is not None and len(np.unique(y_true)) > 1:
        metrics["auc"] = roc_auc_score(y_true, y_prob)
    else:
        metrics["auc"] = 0.5

    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    metrics["confusion_matrix"] = cm.tolist()

    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
        metrics["true_negatives"] = int(tn)
        metrics["false_positives"] = int(fp)
        metrics["false_negatives"] = int(fn)
        metrics["true_positives"] = int(tp)
        metrics["specificity"] = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    return metrics


def print_evaluation_report(metrics: dict, title: str = "Evaluation Results"):
    """Print formatted evaluation report."""
    print(f"\n{'=' * 50}")
    print(f"{title}")
    print("=" * 50)

    print(f"Accuracy:    {metrics['accuracy']:.4f}")
    print(f"Precision:   {metrics['precision']:.4f}")
    print(f"Recall:      {metrics['recall']:.4f}")
    print(f"F1 Score:    {metrics['f1']:.4f}")
    print(f"AUC-ROC:     {metrics['auc']:.4f}")

    if "specificity" in metrics:
        print(f"Specificity: {metrics['specificity']:.4f}")

    if "confusion_matrix" in metrics:
        print("\nConfusion Matrix:")
        cm = np.array(metrics["confusion_matrix"])
        print(f"  TN: {cm[0, 0]:5d}  FP: {cm[0, 1]:5d}")
        print(f"  FN: {cm[1, 0]:5d}  TP: {cm[1, 1]:5d}")

    print("=" * 50)


def evaluate_model(model, data, device: str = "cpu") -> dict:
    """
    Evaluate trained GNN model on test set.

    Args:
        model: Trained GNN model
        data: PyG Data object
        device: Device

    Returns:
        Dictionary of metrics
    """
    import torch

    model.eval()
    data = data.to(device)

    with torch.no_grad():
        out = model(data.x, data.edge_index)
        probs = torch.softmax(out, dim=1)[:, 1]

    test_mask = data.test_mask.cpu().numpy()
    y_true = data.y.cpu().numpy()[test_mask]
    y_prob = probs.cpu().numpy()[test_mask]

    # Filter valid labels
    valid = ~np.isnan(y_true)
    y_true = y_true[valid].astype(int)
    y_prob = y_prob[valid]
    y_pred = (y_prob >= 0.5).astype(int)

    metrics = evaluate_node_classification(y_true, y_pred, y_prob)

    log.info(
        f"Test Results - Accuracy: {metrics['accuracy']:.4f}, "
        f"AUC: {metrics['auc']:.4f}, F1: {metrics['f1']:.4f}"
    )

    return metrics


def get_predictions(
    model,
    data,
    device: str = "cpu",
    threshold: float = 0.5,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Get predictions for all nodes.

    Args:
        model: Trained GNN model
        data: PyG Data object
        device: Device
        threshold: Classification threshold

    Returns:
        Tuple of (predictions, probabilities, embeddings)
    """
    import torch

    model.eval()
    data = data.to(device)

    with torch.no_grad():
        out = model(data.x, data.edge_index)
        probs = torch.softmax(out, dim=1)[:, 1].cpu().numpy()
        embeddings = model.get_embeddings(data.x, data.edge_index).cpu().numpy()

    predictions = (probs >= threshold).astype(int)

    return predictions, probs, embeddings


def find_optimal_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    metric: str = "f1",
) -> tuple[float, float]:
    """
    Find optimal classification threshold.

    Args:
        y_true: True labels
        y_prob: Prediction probabilities
        metric: Metric to optimize ('f1', 'precision', 'recall')

    Returns:
        Tuple of (optimal_threshold, best_metric_value)
    """
    from sklearn.metrics import precision_score, recall_score, f1_score

    best_threshold = 0.5
    best_score = 0.0

    for threshold in np.arange(0.1, 0.9, 0.05):
        y_pred = (y_prob >= threshold).astype(int)

        if metric == "f1":
            score = f1_score(y_true, y_pred, zero_division=0)
        elif metric == "precision":
            score = precision_score(y_true, y_pred, zero_division=0)
        elif metric == "recall":
            score = recall_score(y_true, y_pred, zero_division=0)
        else:
            raise ValueError(f"Unknown metric: {metric}")

        if score > best_score:
            best_score = score
            best_threshold = threshold

    log.info(f"Optimal threshold: {best_threshold:.2f} ({metric}={best_score:.4f})")
    return best_threshold, best_score
