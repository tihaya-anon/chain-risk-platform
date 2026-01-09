"""Model registry for storing and retrieving ML models from MinIO."""

import json
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import joblib
import yaml

from log_config import get_logger

log = get_logger("model_registry")


class ModelRegistry:
    """Manage ML models in MinIO object storage."""

    def __init__(self, config_path: str = "configs/training_config.yaml"):
        with open(config_path) as f:
            config = yaml.safe_load(f)

        self.cfg = config["registry"]
        self.bucket = self.cfg["bucket"]
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from minio import Minio

            log.debug(f"Connecting to MinIO at {self.cfg['endpoint']}")
            self._client = Minio(
                self.cfg["endpoint"],
                access_key=self.cfg["access_key"],
                secret_key=self.cfg["secret_key"],
                secure=self.cfg["secure"],
            )
            if not self._client.bucket_exists(self.bucket):
                self._client.make_bucket(self.bucket)
                log.info(f"Created bucket: {self.bucket}")
        return self._client

    def upload_model(
        self,
        model: Any,
        model_name: str,
        version: str,
        metrics: Optional[dict] = None,
        features: Optional[list[str]] = None,
        hyperparameters: Optional[dict] = None,
    ) -> str:
        """Upload sklearn/xgboost model to MinIO."""
        log.info(f"Uploading {model_name}/{version} to MinIO")

        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        model_path = local_dir / "model.pkl"
        joblib.dump(model, model_path)
        log.debug(f"Saved model to {model_path}")

        metadata = {
            "model_name": model_name,
            "model_type": "sklearn",
            "version": version,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "metrics": metrics or {},
            "features": features or [],
            "hyperparameters": hyperparameters or {},
        }
        metadata_path = local_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        object_prefix = f"{model_name}/{version}"
        self.client.fput_object(self.bucket, f"{object_prefix}/model.pkl", str(model_path))
        self.client.fput_object(self.bucket, f"{object_prefix}/metadata.json", str(metadata_path))

        self._update_latest(model_name, version)
        log.info(f"Uploaded {model_name}/{version} to MinIO")

        return f"{object_prefix}/model.pkl"

    def upload_gnn_model(
        self,
        model_path: str,
        model_type: str,
        version: str,
        metrics: Optional[dict] = None,
        feature_cols: Optional[list[str]] = None,
        model_config: Optional[dict] = None,
    ) -> str:
        """
        Upload GNN model (PyTorch) to MinIO.

        Args:
            model_path: Local path to saved .pt file
            model_type: GNN type (gcn, gat, sage)
            version: Model version
            metrics: Evaluation metrics
            feature_cols: Feature column names
            model_config: Model configuration

        Returns:
            Object path in MinIO
        """
        model_name = f"gnn_{model_type}"
        log.info(f"Uploading {model_name}/{version} to MinIO")

        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        # Copy model file
        import shutil

        dest_model_path = local_dir / "model.pt"
        shutil.copy(model_path, dest_model_path)

        # Create metadata
        metadata = {
            "model_name": model_name,
            "model_type": "gnn",
            "gnn_type": model_type,
            "version": version,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "metrics": metrics or {},
            "feature_cols": feature_cols or [],
            "model_config": model_config or {},
        }
        metadata_path = local_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        # Upload to MinIO
        object_prefix = f"{model_name}/{version}"
        self.client.fput_object(self.bucket, f"{object_prefix}/model.pt", str(dest_model_path))
        self.client.fput_object(self.bucket, f"{object_prefix}/metadata.json", str(metadata_path))

        self._update_latest(model_name, version)
        log.info(f"Uploaded GNN model {model_name}/{version} to MinIO")

        return f"{object_prefix}/model.pt"

    def download_model(self, model_name: str, version: str = "latest") -> tuple[Any, dict]:
        """Download sklearn/xgboost model from MinIO."""
        if version == "latest":
            version = self._get_latest_version(model_name)
            if not version:
                raise ValueError(f"No versions found for model: {model_name}")

        log.info(f"Downloading {model_name}/{version} from MinIO")

        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        object_prefix = f"{model_name}/{version}"
        model_path = local_dir / "model.pkl"
        metadata_path = local_dir / "metadata.json"

        self.client.fget_object(self.bucket, f"{object_prefix}/model.pkl", str(model_path))
        self.client.fget_object(self.bucket, f"{object_prefix}/metadata.json", str(metadata_path))

        model = joblib.load(model_path)
        with open(metadata_path) as f:
            metadata = json.load(f)

        log.info(f"Downloaded {model_name}/{version}")
        return model, metadata

    def download_gnn_model(
        self, model_name: str, version: str = "latest", device: str = "cpu"
    ) -> tuple[Any, dict]:
        """
        Download GNN model from MinIO.

        Args:
            model_name: Model name (e.g., 'gnn_sage')
            version: Model version or 'latest'
            device: Device to load model on

        Returns:
            Tuple of (model, metadata)
        """
        import torch
        from gnn.models import create_gnn_model

        if version == "latest":
            version = self._get_latest_version(model_name)
            if not version:
                raise ValueError(f"No versions found for model: {model_name}")

        log.info(f"Downloading GNN model {model_name}/{version} from MinIO")

        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        object_prefix = f"{model_name}/{version}"
        model_path = local_dir / "model.pt"
        metadata_path = local_dir / "metadata.json"

        self.client.fget_object(self.bucket, f"{object_prefix}/model.pt", str(model_path))
        self.client.fget_object(self.bucket, f"{object_prefix}/metadata.json", str(metadata_path))

        # Load metadata
        with open(metadata_path) as f:
            metadata = json.load(f)

        # Load checkpoint
        checkpoint = torch.load(model_path, map_location=device)

        # Recreate model
        model_config = checkpoint.get("model_config", metadata.get("model_config", {}))
        gnn_type = checkpoint.get("model_type", metadata.get("gnn_type", "sage"))
        feature_cols = checkpoint.get("feature_cols", metadata.get("feature_cols", []))

        model = create_gnn_model(
            model_type=gnn_type,
            in_channels=len(feature_cols),
            hidden_channels=model_config.get("hidden_dim", 128),
            out_channels=model_config.get("out_channels", 2),
            num_layers=model_config.get("num_layers", 2),
            dropout=model_config.get("dropout", 0.3),
            **model_config.get(gnn_type, {}),
        )

        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(device)
        model.eval()

        # Add extra info to metadata
        metadata["norm_params"] = checkpoint.get("norm_params")
        metadata["feature_cols"] = feature_cols

        log.info(f"Downloaded GNN model {model_name}/{version}")
        return model, metadata

    def list_versions(self, model_name: str) -> list[str]:
        """List all versions of a model."""
        objects = self.client.list_objects(self.bucket, prefix=f"{model_name}/", recursive=False)
        versions = []
        for obj in objects:
            parts = obj.object_name.rstrip("/").split("/")
            if len(parts) >= 2:
                version = parts[1]
                if version not in ("latest.json",) and version not in versions:
                    versions.append(version)
        return sorted(versions)

    def list_models(self) -> list[str]:
        """List all model names in registry."""
        objects = self.client.list_objects(self.bucket, recursive=False)
        models = []
        for obj in objects:
            name = obj.object_name.rstrip("/")
            if "/" not in name and name not in models:
                models.append(name)
        return sorted(models)

    def get_metadata(self, model_name: str, version: str) -> dict:
        """Get metadata for a specific model version."""
        response = self.client.get_object(self.bucket, f"{model_name}/{version}/metadata.json")
        return json.load(BytesIO(response.read()))

    def delete_version(self, model_name: str, version: str) -> None:
        """Delete a specific model version."""
        objects = self.client.list_objects(
            self.bucket, prefix=f"{model_name}/{version}/", recursive=True
        )
        for obj in objects:
            self.client.remove_object(self.bucket, obj.object_name)
        log.info(f"Deleted {model_name}/{version}")

    def _update_latest(self, model_name: str, version: str) -> None:
        latest_data = json.dumps({"version": version}).encode()
        self.client.put_object(
            self.bucket,
            f"{model_name}/latest.json",
            BytesIO(latest_data),
            len(latest_data),
            content_type="application/json",
        )
        log.debug(f"Updated latest pointer for {model_name} to {version}")

    def _get_latest_version(self, model_name: str) -> Optional[str]:
        try:
            response = self.client.get_object(self.bucket, f"{model_name}/latest.json")
            data = json.load(BytesIO(response.read()))
            return data.get("version")
        except Exception:
            return None
