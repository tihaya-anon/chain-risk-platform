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
        """Upload model to MinIO."""
        log.info(f"Uploading {model_name}/{version} to MinIO")
        
        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        model_path = local_dir / "model.pkl"
        joblib.dump(model, model_path)
        log.debug(f"Saved model to {model_path}")

        metadata = {
            "model_name": model_name,
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

    def download_model(self, model_name: str, version: str = "latest") -> tuple[Any, dict]:
        """Download model from MinIO."""
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

    def get_metadata(self, model_name: str, version: str) -> dict:
        """Get metadata for a specific model version."""
        response = self.client.get_object(self.bucket, f"{model_name}/{version}/metadata.json")
        return json.load(BytesIO(response.read()))

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
