"""GNN predictor for graph-based risk scoring."""

import logging
from typing import Optional

import numpy as np

from .model_loader import ModelLoader, ModelInfo
from .feature_client import FeatureClient, normalize_features, FEATURE_COLUMNS

log = logging.getLogger(__name__)


class GNNPredictor:
    """GNN-based risk predictor."""

    def __init__(self, device: str = "cpu"):
        self.device = device
        self.model = None
        self.model_info: Optional[ModelInfo] = None
        self.loader = ModelLoader()
        self.feature_client = FeatureClient()
        self._torch_available = False

        try:
            import torch
            self._torch_available = True
        except ImportError:
            log.warning("PyTorch not available, GNN predictions disabled")

    async def load_model(self, model_name: str = "gnn_sage", version: str = "latest"):
        """Load GNN model from registry."""
        if not self._torch_available:
            raise RuntimeError("PyTorch not available")

        self.model, self.model_info = self.loader.download_gnn_model(
            model_name, version, self.device
        )
        log.info(f"Loaded GNN model: {model_name}/{self.model_info.version}")

    def is_ready(self) -> bool:
        """Check if model is loaded."""
        return self.model is not None and self._torch_available

    async def predict(
        self,
        address: str,
        network: str = "ethereum",
        use_subgraph: bool = True,
    ) -> Optional[dict]:
        """
        Predict risk score for an address.

        Args:
            address: Ethereum address
            network: Network name
            use_subgraph: Whether to use subgraph context

        Returns:
            Prediction dict with score and embedding, or None
        """
        if not self.is_ready():
            log.warning("GNN model not ready")
            return None

        import torch
        from torch_geometric.data import Data

        address = address.lower()

        # Get features
        features = await self.feature_client.get_features(address, network)
        if not features:
            log.debug(f"No features for {address}, skipping GNN")
            return None

        # Normalize features
        x = normalize_features(
            features,
            self.model_info.norm_params,
            method="standard",
        )

        if use_subgraph:
            # Get subgraph for context
            subgraph = await self.feature_client.get_subgraph(address, network)
            if subgraph and len(subgraph["nodes"]) > 1:
                return await self._predict_with_subgraph(address, features, subgraph)

        # Single node prediction (no graph context)
        return await self._predict_single(address, x)

    async def _predict_single(self, address: str, features: np.ndarray) -> dict:
        """Predict using single node features (no graph)."""
        import torch

        x = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(self.device)
        edge_index = torch.zeros((2, 0), dtype=torch.long).to(self.device)

        with torch.no_grad():
            out = self.model(x, edge_index)
            probs = torch.softmax(out, dim=1)
            embedding = self.model.get_embeddings(x, edge_index)

        score = probs[0, 1].item()
        emb = embedding[0].cpu().numpy().tolist()

        return {
            "address": address,
            "score": score,
            "embedding": emb,
            "method": "gnn_single",
        }

    async def _predict_with_subgraph(
        self, address: str, center_features: dict, subgraph: dict
    ) -> dict:
        """Predict using subgraph context."""
        import torch

        nodes = subgraph["nodes"]
        edges = subgraph["edges"]

        # Build node index mapping
        node_to_idx = {n["address"]: i for i, n in enumerate(nodes)}
        center_idx = node_to_idx.get(address, 0)

        # Get features for all nodes
        addresses = [n["address"] for n in nodes]
        features_batch = await self.feature_client.get_features_batch(addresses)

        # Build feature matrix
        x_list = []
        for node in nodes:
            addr = node["address"]
            if addr in features_batch:
                feat = normalize_features(
                    features_batch[addr],
                    self.model_info.norm_params,
                    method="standard",
                )
            else:
                # Use center features or zeros
                if addr == address:
                    feat = normalize_features(
                        center_features,
                        self.model_info.norm_params,
                        method="standard",
                    )
                else:
                    feat = np.zeros(len(FEATURE_COLUMNS), dtype=np.float32)
            x_list.append(feat)

        x = torch.tensor(np.array(x_list), dtype=torch.float32).to(self.device)

        # Build edge index
        edge_sources = []
        edge_targets = []
        for e in edges:
            src = node_to_idx.get(e["source"])
            tgt = node_to_idx.get(e["target"])
            if src is not None and tgt is not None:
                edge_sources.append(src)
                edge_targets.append(tgt)

        if edge_sources:
            edge_index = torch.tensor(
                [edge_sources, edge_targets], dtype=torch.long
            ).to(self.device)
        else:
            edge_index = torch.zeros((2, 0), dtype=torch.long).to(self.device)

        # Predict
        with torch.no_grad():
            out = self.model(x, edge_index)
            probs = torch.softmax(out, dim=1)
            embedding = self.model.get_embeddings(x, edge_index)

        score = probs[center_idx, 1].item()
        emb = embedding[center_idx].cpu().numpy().tolist()

        return {
            "address": address,
            "score": score,
            "embedding": emb,
            "method": "gnn_subgraph",
            "subgraph_size": len(nodes),
        }

    async def predict_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
    ) -> list[Optional[dict]]:
        """Predict for multiple addresses."""
        results = []
        for addr in addresses:
            try:
                result = await self.predict(addr, network, use_subgraph=False)
                results.append(result)
            except Exception as e:
                log.error(f"GNN prediction failed for {addr}: {e}")
                results.append(None)
        return results

    def close(self):
        """Cleanup resources."""
        self.feature_client.close()
