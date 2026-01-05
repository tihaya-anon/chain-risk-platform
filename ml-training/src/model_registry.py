"""Model registry for storing and retrieving ML models from MinIO."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import joblib
import yaml


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
        """Lazy-load MinIO client."""
        if self._client is None:
            from minio import Minio
            self._client = Minio(
                self.cfg["endpoint"],
                access_key=self.cfg["access_key"],
                secret_key=self.cfg["secret_key"],
                secure=self.cfg["secure"],
            )
            # Ensure bucket exists
            if not self._client.bucket_exists(self.bucket):
                self._client.make_bucket(self.bucket)
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
        """Upload model to MinIO.
        
        Args:
            model: Trained model object (sklearn/xgboost)
            model_name: Name of the model (e.g., 'xgboost', 'isolation_forest')
            version: Version string (e.g., 'v1', 'v2')
            metrics: Model evaluation metrics
            features: List of feature names used
            hyperparameters: Model hyperparameters
        
        Returns:
            Object path in MinIO
        """
        # Save model locally first
        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        model_path = local_dir / "model.pkl"
        joblib.dump(model, model_path)

        # Create metadata
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

        # Upload to MinIO
        object_prefix = f"{model_name}/{version}"
        self.client.fput_object(
            self.bucket,
            f"{object_prefix}/model.pkl",
            str(model_path),
        )
        self.client.fput_object(
            self.bucket,
            f"{object_prefix}/metadata.json",
            str(metadata_path),
        )

        # Update latest pointer
        self._update_latest(model_name, version)

        print(f"Uploaded {model_name}/{version} to MinIO")
        return f"{object_prefix}/model.pkl"

    def download_model(
        self,
        model_name: str,
        version: str = "latest",
    ) -> tuple[Any, dict]:
        """Download model from MinIO.
        
        Args:
            model_name: Name of the model
            version: Version string or 'latest'
        
        Returns:
            Tuple of (model, metadata)
        """
        if version == "latest":
            version = self._get_latest_version(model_name)
            if not version:
                raise ValueError(f"No versions found for model: {model_name}")

        local_dir = Path(f"/tmp/ml-models/{model_name}/{version}")
        local_dir.mkdir(parents=True, exist_ok=True)

        object_prefix = f"{model_name}/{version}"

        # Download files
        model_path = local_dir / "model.pkl"
        metadata_path = local_dir / "metadata.json"

        self.client.fget_object(
            self.bucket,
            f"{object_prefix}/model.pkl",
            str(model_path),
        )
        self.client.fget_object(
            self.bucket,
            f"{object_prefix}/metadata.json",
            str(metadata_path),
        )

        # Load model and metadata
        model = joblib.load(model_path)
        with open(metadata_path) as f:
            metadata = json.load(f)

        print(f"Downloaded {model_name}/{version} from MinIO")
        return model, metadata

    def list_versions(self, model_name: str) -> list[str]:
        """List all versions of a model."""
        objects = self.client.list_objects(
            self.bucket,
            prefix=f"{model_name}/",
            recursive=False,
        )
        versions = []
        for obj in objects:
            # Extract version from path like "xgboost/v1/"
            parts = obj.object_name.rstrip("/").split("/")
            if len(parts) >= 2:
                version = parts[1]
                if version not in ("latest.json",) and version not in versions:
                    versions.append(version)
        return sorted(versions)

    def get_metadata(self, model_name: str, version: str) -> dict:
        """Get metadata for a specific model version."""
        from io import BytesIO

        response = self.client.get_object(
            self.bucket,
            f"{model_name}/{version}/metadata.json",
        )
        return json.load(BytesIO(response.read()))

    def _update_latest(self, model_name: str, version: str) -> None:
        """Update the latest.json pointer."""
        from io import BytesIO

        latest_data = json.dumps({"version": version}).encode()
        self.client.put_object(
            self.bucket,
            f"{model_name}/latest.json",
            BytesIO(latest_data),
            len(latest_data),
            content_type="application/json",
        )

    def _get_latest_version(self, model_name: str) -> Optional[str]:
        """Get the latest version for a model."""
        try:
            from io import BytesIO
            response = self.client.get_object(
                self.bucket,
                f"{model_name}/latest.json",
            )
            data = json.load(BytesIO(response.read()))
            return data.get("version")
        except Exception:
            return None
