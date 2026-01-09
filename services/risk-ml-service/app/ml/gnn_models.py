"""Simplified GNN models for inference (no training dependencies)."""

import torch
import torch.nn as nn
import torch.nn.functional as F


class GCN(nn.Module):
    """Graph Convolutional Network."""

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        **kwargs,
    ):
        super().__init__()
        from torch_geometric.nn import GCNConv

        self.dropout = dropout
        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        self.convs.append(GCNConv(in_channels, hidden_channels))
        self.bns.append(nn.BatchNorm1d(hidden_channels))

        for _ in range(num_layers - 2):
            self.convs.append(GCNConv(hidden_channels, hidden_channels))
            self.bns.append(nn.BatchNorm1d(hidden_channels))

        self.convs.append(GCNConv(hidden_channels, out_channels))

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        return self.convs[-1](x, edge_index)

    def get_embeddings(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)
        return x


class GAT(nn.Module):
    """Graph Attention Network."""

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        heads: int = 4,
        concat: bool = True,
        **kwargs,
    ):
        super().__init__()
        from torch_geometric.nn import GATConv

        self.dropout = dropout
        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        self.convs.append(GATConv(in_channels, hidden_channels, heads=heads, concat=concat))
        hidden_out = hidden_channels * heads if concat else hidden_channels
        self.bns.append(nn.BatchNorm1d(hidden_out))

        for _ in range(num_layers - 2):
            self.convs.append(GATConv(hidden_out, hidden_channels, heads=heads, concat=concat))
            self.bns.append(nn.BatchNorm1d(hidden_out))

        self.convs.append(GATConv(hidden_out, out_channels, heads=1, concat=False))

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.elu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        return self.convs[-1](x, edge_index)

    def get_embeddings(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.elu(x)
        return x


class GraphSAGE(nn.Module):
    """GraphSAGE for inductive learning."""

    def __init__(
        self,
        in_channels: int,
        hidden_channels: int,
        out_channels: int,
        num_layers: int = 2,
        dropout: float = 0.3,
        aggregator: str = "mean",
        **kwargs,
    ):
        super().__init__()
        from torch_geometric.nn import SAGEConv

        self.dropout = dropout
        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()

        self.convs.append(SAGEConv(in_channels, hidden_channels, aggr=aggregator))
        self.bns.append(nn.BatchNorm1d(hidden_channels))

        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels, aggr=aggregator))
            self.bns.append(nn.BatchNorm1d(hidden_channels))

        self.convs.append(SAGEConv(hidden_channels, out_channels, aggr=aggregator))

    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        return self.convs[-1](x, edge_index)

    def get_embeddings(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = self.bns[i](x)
            x = F.relu(x)
        return x


def create_gnn_model(
    model_type: str,
    in_channels: int,
    hidden_channels: int,
    out_channels: int = 2,
    num_layers: int = 2,
    dropout: float = 0.3,
    **kwargs,
):
    """Factory function to create GNN models."""
    model_type = model_type.lower()

    if model_type == "gcn":
        return GCN(in_channels, hidden_channels, out_channels, num_layers, dropout, **kwargs)
    elif model_type == "gat":
        return GAT(in_channels, hidden_channels, out_channels, num_layers, dropout, **kwargs)
    elif model_type == "sage":
        return GraphSAGE(in_channels, hidden_channels, out_channels, num_layers, dropout, **kwargs)
    else:
        raise ValueError(f"Unknown model type: {model_type}")
