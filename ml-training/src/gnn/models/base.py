"""Base GNN model class."""

import logging
from abc import ABC, abstractmethod
from typing import Optional

log = logging.getLogger(__name__)


class BaseGNN(ABC):
    """Abstract base class for GNN models."""

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.out_channels = out_channels
        self.num_layers = num_layers
        self.dropout = dropout

    @abstractmethod
    def forward(self, x, edge_index):
        """Forward pass."""
        pass

    @abstractmethod
    def get_embeddings(self, x, edge_index):
        """Get node embeddings (before final classifier)."""
        pass

    def reset_parameters(self):
        """Reset all learnable parameters."""
        for module in self.modules():
            if hasattr(module, "reset_parameters"):
                module.reset_parameters()


def create_gnn_model(
    model_type: str,
    in_channels: int,
    hidden_channels: int,
    out_channels: int = 2,
    num_layers: int = 2,
    dropout: float = 0.3,
    **kwargs,
):
    """
    Factory function to create GNN models.

    Args:
        model_type: Model type ('gcn', 'gat', 'sage')
        in_channels: Input feature dimension
        hidden_channels: Hidden layer dimension
        out_channels: Output dimension (num classes)
        num_layers: Number of GNN layers
        dropout: Dropout rate
        **kwargs: Model-specific arguments

    Returns:
        GNN model instance
    """
    model_type = model_type.lower()

    if model_type == "gcn":
        from .gcn import GCN

        return GCN(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_layers=num_layers,
            dropout=dropout,
            improved=kwargs.get("improved", True),
            cached=kwargs.get("cached", False),
        )

    elif model_type == "gat":
        from .gat import GAT

        return GAT(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_layers=num_layers,
            dropout=dropout,
            heads=kwargs.get("heads", 4),
            concat=kwargs.get("concat", True),
            negative_slope=kwargs.get("negative_slope", 0.2),
        )

    elif model_type == "sage":
        from .sage import GraphSAGE

        return GraphSAGE(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_layers=num_layers,
            dropout=dropout,
            aggregator=kwargs.get("aggregator", "mean"),
        )

    else:
        raise ValueError(f"Unknown model type: {model_type}")
