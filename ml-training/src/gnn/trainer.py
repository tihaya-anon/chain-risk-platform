"""GNN trainer with early stopping and evaluation."""

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import torch

log = logging.getLogger(__name__)


@dataclass
class TrainingMetrics:
    """Container for training metrics."""

    train_loss: list[float] = field(default_factory=list)
    val_loss: list[float] = field(default_factory=list)
    val_acc: list[float] = field(default_factory=list)
    val_auc: list[float] = field(default_factory=list)
    best_epoch: int = 0
    best_val_loss: float = float("inf")
    best_val_auc: float = 0.0
    training_time: float = 0.0


class EarlyStopping:
    """Early stopping handler."""

    def __init__(self, patience: int = 20, min_delta: float = 0.001, mode: str = "min"):
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_value = None
        self.should_stop = False

    def __call__(self, value: float) -> bool:
        if self.best_value is None:
            self.best_value = value
            return False

        if self.mode == "min":
            improved = value < self.best_value - self.min_delta
        else:
            improved = value > self.best_value + self.min_delta

        if improved:
            self.best_value = value
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True

        return self.should_stop


class GNNTrainer:
    """Trainer for GNN models."""

    def __init__(
        self,
        model,
        optimizer,
        criterion,
        device: str = "cpu",
        scheduler=None,
    ):
        """
        Initialize trainer.

        Args:
            model: GNN model
            optimizer: PyTorch optimizer
            criterion: Loss function
            device: Device to use ('cpu' or 'cuda')
            scheduler: Learning rate scheduler (optional)
        """
        self.model = model.to(device)
        self.optimizer = optimizer
        self.criterion = criterion
        self.device = device
        self.scheduler = scheduler
        self.metrics = TrainingMetrics()

    def train_epoch(self, data) -> float:
        """Train for one epoch."""
        self.model.train()
        self.optimizer.zero_grad()

        data = data.to(self.device)
        out = self.model(data.x, data.edge_index)

        # Get valid training labels (non-NaN)
        train_mask = data.train_mask
        y = data.y[train_mask]

        # Filter out NaN labels
        valid_mask = ~torch.isnan(y)
        if valid_mask.sum() == 0:
            return 0.0

        pred = out[train_mask][valid_mask]
        y = y[valid_mask].long()

        loss = self.criterion(pred, y)
        loss.backward()
        self.optimizer.step()

        return loss.item()

    @torch.no_grad()
    def evaluate(self, data, mask_name: str = "val_mask") -> dict:
        """Evaluate model on a data split."""
        self.model.eval()
        data = data.to(self.device)

        out = self.model(data.x, data.edge_index)
        mask = getattr(data, mask_name)
        y = data.y[mask]

        # Filter valid labels
        valid_mask = ~torch.isnan(y)
        if valid_mask.sum() == 0:
            return {"loss": 0.0, "accuracy": 0.0, "auc": 0.0}

        pred = out[mask][valid_mask]
        y = y[valid_mask].long()

        loss = self.criterion(pred, y).item()

        # Compute metrics
        probs = torch.softmax(pred, dim=1)[:, 1].cpu().numpy()
        pred_labels = pred.argmax(dim=1).cpu().numpy()
        y_np = y.cpu().numpy()

        accuracy = (pred_labels == y_np).mean()

        try:
            from sklearn.metrics import roc_auc_score

            auc = roc_auc_score(y_np, probs) if len(np.unique(y_np)) > 1 else 0.5
        except Exception:
            auc = 0.5

        return {"loss": loss, "accuracy": accuracy, "auc": auc}

    def train(
        self,
        data,
        epochs: int = 200,
        patience: int = 20,
        min_delta: float = 0.001,
        checkpoint_dir: Optional[str] = None,
        verbose: bool = True,
    ) -> TrainingMetrics:
        """
        Full training loop with early stopping.

        Args:
            data: PyG Data object
            epochs: Maximum number of epochs
            patience: Early stopping patience
            min_delta: Minimum improvement for early stopping
            checkpoint_dir: Directory to save checkpoints
            verbose: Print progress

        Returns:
            TrainingMetrics object
        """
        early_stopping = EarlyStopping(patience=patience, min_delta=min_delta, mode="max")
        best_model_state = None
        start_time = time.time()

        if checkpoint_dir:
            checkpoint_path = Path(checkpoint_dir)
            checkpoint_path.mkdir(parents=True, exist_ok=True)

        for epoch in range(epochs):
            # Train
            train_loss = self.train_epoch(data)
            self.metrics.train_loss.append(train_loss)

            # Validate
            val_metrics = self.evaluate(data, "val_mask")
            self.metrics.val_loss.append(val_metrics["loss"])
            self.metrics.val_acc.append(val_metrics["accuracy"])
            self.metrics.val_auc.append(val_metrics["auc"])

            # Learning rate scheduling
            if self.scheduler:
                self.scheduler.step(val_metrics["loss"])

            # Check for best model
            if val_metrics["auc"] > self.metrics.best_val_auc:
                self.metrics.best_val_auc = val_metrics["auc"]
                self.metrics.best_val_loss = val_metrics["loss"]
                self.metrics.best_epoch = epoch
                best_model_state = {k: v.cpu().clone() for k, v in self.model.state_dict().items()}

                if checkpoint_dir:
                    self.save_checkpoint(checkpoint_path / "best_model.pt")

            # Log progress
            if verbose and (epoch + 1) % 10 == 0:
                log.info(
                    f"Epoch {epoch + 1}/{epochs} - "
                    f"Train Loss: {train_loss:.4f}, "
                    f"Val Loss: {val_metrics['loss']:.4f}, "
                    f"Val AUC: {val_metrics['auc']:.4f}"
                )

            # Early stopping
            if early_stopping(val_metrics["auc"]):
                log.info(f"Early stopping at epoch {epoch + 1}")
                break

        # Restore best model
        if best_model_state:
            self.model.load_state_dict(best_model_state)

        self.metrics.training_time = time.time() - start_time
        log.info(
            f"Training complete - Best Epoch: {self.metrics.best_epoch + 1}, "
            f"Best Val AUC: {self.metrics.best_val_auc:.4f}, "
            f"Time: {self.metrics.training_time:.1f}s"
        )

        return self.metrics

    def save_checkpoint(self, path: str):
        """Save model checkpoint."""
        torch.save(
            {
                "model_state_dict": self.model.state_dict(),
                "optimizer_state_dict": self.optimizer.state_dict(),
                "metrics": self.metrics,
            },
            path,
        )

    def load_checkpoint(self, path: str):
        """Load model checkpoint."""
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        self.metrics = checkpoint.get("metrics", TrainingMetrics())
