"""Unit tests for GNN trainer."""

import pytest
import torch
import torch.nn as nn


class TestEarlyStopping:
    """Tests for EarlyStopping class."""

    def test_no_stop_improving(self):
        """No stop when metric keeps improving."""
        from src.gnn.trainer import EarlyStopping

        es = EarlyStopping(patience=3, mode="max")

        values = [0.5, 0.6, 0.7, 0.8]
        for v in values:
            assert not es(v)

        assert not es.should_stop

    def test_stop_after_patience(self):
        """Stop after patience epochs without improvement."""
        from src.gnn.trainer import EarlyStopping

        es = EarlyStopping(patience=3, mode="max")

        es(0.5)
        es(0.6)
        es(0.7)  # Best
        es(0.65)  # Worse 1
        es(0.64)  # Worse 2
        result = es(0.63)  # Worse 3 -> should stop

        assert result is True
        assert es.should_stop

    def test_mode_min(self):
        """Mode='min' stops when loss stops decreasing."""
        from src.gnn.trainer import EarlyStopping

        es = EarlyStopping(patience=2, mode="min")

        es(1.0)
        es(0.8)
        es(0.6)  # Best
        es(0.7)  # Worse 1
        result = es(0.8)  # Worse 2 -> stop

        assert result is True

    def test_min_delta(self):
        """Improvements smaller than min_delta don't count."""
        from src.gnn.trainer import EarlyStopping

        es = EarlyStopping(patience=2, min_delta=0.1, mode="max")

        es(0.5)
        es(0.51)  # Not enough improvement
        result = es(0.52)  # Still not enough -> stop

        assert result is True


class TestTrainingMetrics:
    """Tests for TrainingMetrics dataclass."""

    def test_default_values(self):
        """Default values are correct."""
        from src.gnn.trainer import TrainingMetrics

        metrics = TrainingMetrics()

        assert metrics.train_loss == []
        assert metrics.val_loss == []
        assert metrics.best_epoch == 0
        assert metrics.best_val_loss == float("inf")
        assert metrics.best_val_auc == 0.0

    def test_append_metrics(self):
        """Can append metrics during training."""
        from src.gnn.trainer import TrainingMetrics

        metrics = TrainingMetrics()

        metrics.train_loss.append(1.0)
        metrics.train_loss.append(0.8)
        metrics.val_auc.append(0.7)

        assert len(metrics.train_loss) == 2
        assert metrics.val_auc[0] == 0.7


class TestGNNTrainer:
    """Tests for GNNTrainer class."""

    @pytest.fixture
    def trainer_setup(self, simple_pyg_data):
        """Setup trainer with simple model and data."""
        from src.gnn.models.sage import GraphSAGE
        from src.gnn.trainer import GNNTrainer

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
        criterion = nn.CrossEntropyLoss()

        trainer = GNNTrainer(
            model=model,
            optimizer=optimizer,
            criterion=criterion,
            device="cpu",
        )

        return trainer, simple_pyg_data

    def test_train_epoch_returns_loss(self, trainer_setup):
        """train_epoch returns a float loss value."""
        trainer, data = trainer_setup

        loss = trainer.train_epoch(data)

        assert isinstance(loss, float)
        assert loss >= 0

    def test_train_epoch_updates_weights(self, trainer_setup):
        """train_epoch updates model weights."""
        trainer, data = trainer_setup

        initial_weights = trainer.model.convs[0].lin_l.weight.clone()

        trainer.train_epoch(data)

        updated_weights = trainer.model.convs[0].lin_l.weight
        assert not torch.allclose(initial_weights, updated_weights)

    def test_evaluate_returns_metrics(self, trainer_setup):
        """evaluate returns dict with required keys."""
        trainer, data = trainer_setup

        metrics = trainer.evaluate(data, "val_mask")

        assert "loss" in metrics
        assert "accuracy" in metrics
        assert "auc" in metrics
        assert 0 <= metrics["accuracy"] <= 1

    def test_train_runs_epochs(self, trainer_setup):
        """Training loop completes some epochs."""
        trainer, data = trainer_setup

        metrics = trainer.train(
            data,
            epochs=5,
            patience=10,  # High patience to avoid early stop
            verbose=False,
        )

        assert len(metrics.train_loss) > 0
        assert metrics.training_time > 0

    def test_train_early_stopping(self, trainer_setup):
        """Training stops early when validation doesn't improve."""
        trainer, data = trainer_setup

        metrics = trainer.train(
            data,
            epochs=100,
            patience=3,
            verbose=False,
        )

        # Should stop before 100 epochs
        assert len(metrics.train_loss) < 100

    def test_best_model_restored(self, trainer_setup):
        """Best model is restored after training."""
        trainer, data = trainer_setup

        metrics = trainer.train(
            data,
            epochs=10,
            patience=5,
            verbose=False,
        )

        assert metrics.best_epoch >= 0
        assert metrics.best_val_auc >= 0


class TestTrainerEdgeCases:
    """Edge case tests for trainer."""

    def test_all_unlabeled(self):
        """Handles data with no labels."""
        from src.gnn.models.sage import GraphSAGE
        from src.gnn.trainer import GNNTrainer
        from torch_geometric.data import Data

        model = GraphSAGE(in_channels=16, hidden_channels=32, out_channels=2)
        optimizer = torch.optim.Adam(model.parameters())
        criterion = nn.CrossEntropyLoss()

        trainer = GNNTrainer(model, optimizer, criterion)

        data = Data(
            x=torch.randn(10, 16),
            edge_index=torch.tensor([[0, 1], [1, 0]]),
            y=torch.full((10,), float("nan")),
            train_mask=torch.zeros(10, dtype=torch.bool),
            val_mask=torch.zeros(10, dtype=torch.bool),
        )

        loss = trainer.train_epoch(data)
        assert loss == 0.0

    def test_single_class(self):
        """Handles single-class validation set."""
        from src.gnn.models.sage import GraphSAGE
        from src.gnn.trainer import GNNTrainer
        from torch_geometric.data import Data

        model = GraphSAGE(in_channels=16, hidden_channels=32, out_channels=2)
        optimizer = torch.optim.Adam(model.parameters())
        criterion = nn.CrossEntropyLoss()

        trainer = GNNTrainer(model, optimizer, criterion)

        y = torch.zeros(10)
        y[:5] = 1
        val_mask = torch.zeros(10, dtype=torch.bool)
        val_mask[5:8] = True  # Val only has class 0

        data = Data(
            x=torch.randn(10, 16),
            edge_index=torch.tensor([[0, 1], [1, 0]]),
            y=y,
            train_mask=torch.tensor([True] * 5 + [False] * 5),
            val_mask=val_mask,
        )

        metrics = trainer.evaluate(data, "val_mask")
        assert metrics["auc"] == 0.5
