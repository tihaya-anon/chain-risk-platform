"""GraphSAGE implementation."""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

from .base import BaseGNN


class GraphSAGE(BaseGNN, nn.Module):
    """
    GraphSAGE for inductive node classification.

    Reference: Hamilton et al., "Inductive Representation Learning on
    Large Graphs", NeurIPS 2017

    GraphSAGE is preferred for production because it supports inductive
    learning - it can make predictions on nodes not seen during training.
    """

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        aggregator: str = "mean",
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

        self.aggregator = aggregator

        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        # Input layer
        self.convs.append(SAGEConv(in_channels, hidden_channels, aggr=aggregator))
        self.bns.append(nn.BatchNorm1d(hidden_channels))

        # Hidden layers
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels, aggr=aggregator))
            self.bns.append(nn.BatchNorm1d(hidden_channels))

        # Output layer
        self.convs.append(SAGEConv(hidden_channels, out_channels, aggr=aggregator))

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
