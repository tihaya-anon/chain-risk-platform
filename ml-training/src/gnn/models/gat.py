"""Graph Attention Network (GAT) implementation."""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATConv

from .base import BaseGNN


class GAT(BaseGNN, nn.Module):
    """
    Graph Attention Network for node classification.

    Reference: Veličković et al., "Graph Attention Networks", ICLR 2018
    """

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        heads: int = 4,
        concat: bool = True,
        negative_slope: float = 0.2,
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

        self.heads = heads
        self.concat = concat
        self.negative_slope = negative_slope

        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        # Input layer
        self.convs.append(
            GATConv(
                in_channels,
                hidden_channels,
                heads=heads,
                concat=concat,
                dropout=dropout,
                negative_slope=negative_slope,
            )
        )
        hidden_out = hidden_channels * heads if concat else hidden_channels
        self.bns.append(nn.BatchNorm1d(hidden_out))

        # Hidden layers
        for _ in range(num_layers - 2):
            self.convs.append(
                GATConv(
                    hidden_out,
                    hidden_channels,
                    heads=heads,
                    concat=concat,
                    dropout=dropout,
                    negative_slope=negative_slope,
                )
            )
            self.bns.append(nn.BatchNorm1d(hidden_out))

        # Output layer (no concat, single head for classification)
        self.convs.append(
            GATConv(
                hidden_out,
                out_channels,
                heads=1,
                concat=False,
                dropout=dropout,
                negative_slope=negative_slope,
            )
        )

    def forward(self, x, edge_index):
        """Forward pass with classification output."""
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.elu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)

        x = self.convs[-1](x, edge_index)
        return x

    def get_embeddings(self, x, edge_index):
        """Get node embeddings before final layer."""
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.elu(x)

        return x
