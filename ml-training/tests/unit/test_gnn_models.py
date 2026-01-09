"""Unit tests for GNN models (GCN, GAT, GraphSAGE)."""

import pytest
import torch


class TestGraphSAGE:
    """Tests for GraphSAGE model."""

    def test_forward_shape(self):
        """Output shape matches (num_nodes, out_channels)."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            num_layers=2,
        )

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 0]])

        out = model(x, edge_index)

        assert out.shape == (10, 2)

    def test_forward_no_edges(self):
        """Model handles graph with no edges."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )

        x = torch.randn(5, 16)
        edge_index = torch.zeros((2, 0), dtype=torch.long)

        out = model(x, edge_index)

        assert out.shape == (5, 2)
        assert not torch.isnan(out).any()

    def test_gradient_flow(self):
        """Gradients flow through all layers."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            num_layers=3,
        )

        x = torch.randn(10, 16, requires_grad=True)
        edge_index = torch.tensor([[0, 1, 2], [1, 2, 0]])

        out = model(x, edge_index)
        loss = out.sum()
        loss.backward()

        # Check gradients exist for all conv layers
        for i, conv in enumerate(model.convs):
            assert conv.lin_l.weight.grad is not None, f"No grad for conv {i}"
            assert conv.lin_l.weight.grad.abs().sum() > 0, f"Zero grad for conv {i}"

    def test_get_embeddings_shape(self):
        """Embeddings have correct shape."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        emb = model.get_embeddings(x, edge_index)

        assert emb.shape == (10, 32)  # hidden_channels

    def test_different_aggregators(self):
        """Different aggregators produce valid outputs."""
        from src.gnn.models.sage import GraphSAGE

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1, 2], [1, 2, 0]])

        for aggr in ["mean", "max"]:
            model = GraphSAGE(
                in_channels=16,
                hidden_channels=32,
                out_channels=2,
                aggregator=aggr,
            )
            out = model(x, edge_index)
            assert out.shape == (10, 2)
            assert not torch.isnan(out).any()


class TestGCN:
    """Tests for GCN model."""

    def test_forward_shape(self):
        """Output shape matches (num_nodes, out_channels)."""
        from src.gnn.models.gcn import GCN

        model = GCN(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 0]])

        out = model(x, edge_index)

        assert out.shape == (10, 2)

    def test_forward_no_edges(self):
        """Model handles isolated nodes."""
        from src.gnn.models.gcn import GCN

        model = GCN(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )

        x = torch.randn(5, 16)
        edge_index = torch.zeros((2, 0), dtype=torch.long)

        out = model(x, edge_index)

        assert out.shape == (5, 2)

    def test_gradient_flow(self):
        """Gradients flow correctly."""
        from src.gnn.models.gcn import GCN

        model = GCN(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            num_layers=2,
        )

        x = torch.randn(10, 16, requires_grad=True)
        edge_index = torch.tensor([[0, 1, 2], [1, 2, 0]])

        out = model(x, edge_index)
        loss = out.sum()
        loss.backward()

        for conv in model.convs:
            assert conv.lin.weight.grad is not None

    def test_get_embeddings_shape(self):
        """Embeddings have correct shape."""
        from src.gnn.models.gcn import GCN

        model = GCN(
            in_channels=16,
            hidden_channels=64,
            out_channels=2,
        )

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        emb = model.get_embeddings(x, edge_index)

        assert emb.shape == (10, 64)


class TestGAT:
    """Tests for GAT model."""

    def test_forward_shape(self):
        """Output shape matches (num_nodes, out_channels)."""
        from src.gnn.models.gat import GAT

        model = GAT(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            heads=4,
        )

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1, 2, 3], [1, 2, 3, 0]])

        out = model(x, edge_index)

        assert out.shape == (10, 2)

    def test_forward_no_edges(self):
        """Model handles no edges."""
        from src.gnn.models.gat import GAT

        model = GAT(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )

        x = torch.randn(5, 16)
        edge_index = torch.zeros((2, 0), dtype=torch.long)

        out = model(x, edge_index)

        assert out.shape == (5, 2)

    def test_multi_head_attention(self):
        """Different head counts work."""
        from src.gnn.models.gat import GAT

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        for heads in [1, 4, 8]:
            model = GAT(
                in_channels=16,
                hidden_channels=32,
                out_channels=2,
                heads=heads,
            )
            out = model(x, edge_index)
            assert out.shape == (10, 2)

    def test_gradient_flow(self):
        """Gradients flow through attention layers."""
        from src.gnn.models.gat import GAT

        model = GAT(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            num_layers=2,
        )

        x = torch.randn(10, 16, requires_grad=True)
        edge_index = torch.tensor([[0, 1, 2], [1, 2, 0]])

        out = model(x, edge_index)
        loss = out.sum()
        loss.backward()

        for conv in model.convs:
            assert conv.lin_src.weight.grad is not None


class TestModelConsistency:
    """Cross-model consistency tests."""

    def test_eval_mode_deterministic(self):
        """Eval mode produces deterministic outputs."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )
        model.eval()

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        out1 = model(x, edge_index)
        out2 = model(x, edge_index)

        assert torch.allclose(out1, out2)

    def test_train_mode_dropout(self):
        """Train mode applies dropout (outputs vary)."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
            dropout=0.5,
        )
        model.train()

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        # Multiple forward passes should differ due to dropout
        outputs = [model(x, edge_index).detach() for _ in range(5)]

        # At least some should be different
        all_same = all(torch.allclose(outputs[0], o) for o in outputs[1:])
        assert not all_same, "Dropout not applied in training mode"

    def test_softmax_valid_probabilities(self):
        """Softmax output sums to 1."""
        from src.gnn.models.sage import GraphSAGE

        model = GraphSAGE(
            in_channels=16,
            hidden_channels=32,
            out_channels=2,
        )
        model.eval()

        x = torch.randn(10, 16)
        edge_index = torch.tensor([[0, 1], [1, 0]])

        out = model(x, edge_index)
        probs = torch.softmax(out, dim=1)

        assert torch.allclose(probs.sum(dim=1), torch.ones(10), atol=1e-5)
        assert (probs >= 0).all()
        assert (probs <= 1).all()
