"""Graph Convolutional Network (GCN) implementation."""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GCNConv

from .base import BaseGNN


class GCN(BaseGNN, nn.Module):
    """
    Graph Convolutional Network for node classification.

    Reference: Kipf & Welling, "Semi-Supervised Classification with Graph
    Convolutional Networks", ICLR 2017
    """

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        improved: bool = True,
        cached: bool = False,
    ):
        BaseGNN.__init__(
            self,
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_layers=num_layers,
            dropout=dropout,
        )
        nn.Module.__init__(self)

        self.improved = improved
        self.cached = cached

        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        # Input layer
        self.convs.append(
            GCNConv(in_channels, hidden_channels, improved=improved, cached=cached)
        )
        self.bns.append(nn.BatchNorm1d(hidden_channels))

        # Hidden layers
        for _ in range(num_layers - 2):
            self.convs.append(
                GCNConv(hidden_channels, hidden_channels, improved=improved, cached=cached)
            )
            self.bns.append(nn.BatchNorm1d(hidden_channels))

        # Output layer
        self.convs.append(
            GCNConv(hidden_channels, out_channels, improved=improved, cached=cached)
        )

    def forward(self, x, edge_index):
        """Forward pass with classification output."""
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)

        x = self.convs[-1](x, edge_index)
        return x

    def get_embeddings(self, x, edge_index):
        """Get node embeddings before final layer."""
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)

        return x
