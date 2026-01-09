"""Model loader for downloading models from MinIO."""

import json
import logging
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

from app.core.config import get_config

log = logging.getLogger(__name__)


@dataclass
class ModelInfo:
    """Model metadata container."""

    name: str
    version: str
    model_type: str  # sklearn, gnn
    metrics: dict
    feature_cols: list[str]
    norm_params: Optional[dict] = None
    config: Optional[dict] = None


class ModelLoader:
    """Load ML models from MinIO registry."""

    def __init__(self):
        self.config = get_config()
        self._client = None
        self._models_dir = Path("/tmp/risk-ml-models")
        self._models_dir.mkdir(parents=True, exist_ok=True)

    @property
    def client(self):
        if self._client is None:
            from minio import Minio

            cfg = self.config.minio
            self._client = Minio(
                cfg.endpoint,
                access_key=cfg.access_key,
                secret_key=cfg.secret_key,
                secure=cfg.secure,
            )
        return self._client

    def get_latest_version(self, model_name: str) -> Optional[str]:
        """Get latest version of a model."""
        try:
            response = self.client.get_object(
                self.config.minio.bucket, f"{model_name}/latest.json"
            )
            data = json.load(BytesIO(response.read()))
            return data.get("version")
        except Exception as e:
            log.warning(f"Failed to get latest version for {model_name}: {e}")
            return None

    def download_sklearn_model(
        self, model_name: str, version: str = "latest"
    ) -> tuple[Any, ModelInfo]:
        """
        Download sklearn/xgboost model.

        Args:
            model_name: Model name (e.g., 'xgboost', 'isolation_forest')
            version: Version or 'latest'

        Returns:
            Tuple of (model, ModelInfo)
        """
        import joblib

        if version == "latest":
            version = self.get_latest_version(model_name)
            if not version:
                raise ValueError(f"No versions found for {model_name}")

        log.info(f"Downloading {model_name}/{version}")

        local_dir = self._models_dir / model_name / version
        local_dir.mkdir(parents=True, exist_ok=True)

        model_path = local_dir / "model.pkl"
        metadata_path = local_dir / "metadata.json"

        bucket = self.config.minio.bucket
        prefix = f"{model_name}/{version}"

        self.client.fget_object(bucket, f"{prefix}/model.pkl", str(model_path))
        self.client.fget_object(bucket, f"{prefix}/metadata.json", str(metadata_path))

        model = joblib.load(model_path)

        with open(metadata_path) as f:
            metadata = json.load(f)

        info = ModelInfo(
            name=model_name,
            version=version,
            model_type="sklearn",
            metrics=metadata.get("metrics", {}),
            feature_cols=metadata.get("features", []),
        )

        log.info(f"Loaded {model_name}/{version}")
        return model, info

    def download_gnn_model(
        self, model_name: str, version: str = "latest", device: str = "cpu"
    ) -> tuple[Any, ModelInfo]:
        """
        Download GNN model.

        Args:
            model_name: Model name (e.g., 'gnn_sage')
            version: Version or 'latest'
            device: Device to load on

        Returns:
            Tuple of (model, ModelInfo)
        """
        import torch

        if version == "latest":
            version = self.get_latest_version(model_name)
            if not version:
                raise ValueError(f"No versions found for {model_name}")

        log.info(f"Downloading GNN {model_name}/{version}")

        local_dir = self._models_dir / model_name / version
        local_dir.mkdir(parents=True, exist_ok=True)

        model_path = local_dir / "model.pt"
        metadata_path = local_dir / "metadata.json"

        bucket = self.config.minio.bucket
        prefix = f"{model_name}/{version}"

        self.client.fget_object(bucket, f"{prefix}/model.pt", str(model_path))
        self.client.fget_object(bucket, f"{prefix}/metadata.json", str(metadata_path))

        with open(metadata_path) as f:
            metadata = json.load(f)

        checkpoint = torch.load(model_path, map_location=device)

        # Recreate model architecture
        model = self._create_gnn_model(checkpoint, metadata, device)

        info = ModelInfo(
            name=model_name,
            version=version,
            model_type="gnn",
            metrics=checkpoint.get("metrics", metadata.get("metrics", {})),
            feature_cols=checkpoint.get("feature_cols", metadata.get("feature_cols", [])),
            norm_params=checkpoint.get("norm_params"),
            config=checkpoint.get("model_config", metadata.get("model_config")),
        )

        log.info(f"Loaded GNN {model_name}/{version}")
        return model, info

    def _create_gnn_model(self, checkpoint: dict, metadata: dict, device: str):
        """Recreate GNN model from checkpoint."""
        import torch.nn as nn

        model_config = checkpoint.get("model_config", metadata.get("model_config", {}))
        gnn_type = checkpoint.get("model_type", metadata.get("gnn_type", "sage"))
        feature_cols = checkpoint.get("feature_cols", metadata.get("feature_cols", []))

        # Import GNN models
        from .gnn_models import create_gnn_model

        model = create_gnn_model(
            model_type=gnn_type,
            in_channels=len(feature_cols),
            hidden_channels=model_config.get("hidden_dim", 128),
            out_channels=2,
            num_layers=model_config.get("num_layers", 2),
            dropout=model_config.get("dropout", 0.3),
        )

        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(device)
        model.eval()

        return model

    def check_for_updates(self, model_name: str, current_version: str) -> Optional[str]:
        """Check if newer version available."""
        latest = self.get_latest_version(model_name)
        if latest and latest != current_version:
            return latest
        return None
