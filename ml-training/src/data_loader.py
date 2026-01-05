"""Data loader for ML training pipeline.

Supports loading data from:
- Trino (Hudi tables)
- PostgreSQL
- Parquet files (local development)
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import yaml


class DataLoader:
    """Load feature and label data from various sources."""

    def __init__(self, config_path: str = "configs/training_config.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)

    def load_features(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load feature data from configured source."""
        source = source or self.config["data"]["source"]

        if source == "trino":
            return self._load_from_trino()
        elif source == "postgres":
            return self._load_from_postgres()
        elif source == "parquet":
            return self._load_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    def load_labels(self, label_type: str = "all") -> pd.DataFrame:
        """Load label data from CSV files.
        
        Args:
            label_type: 'malicious', 'normal', or 'all'
        """
        labels_dir = Path(self.config["data"]["parquet"]["labels_path"])
        dfs = []

        if label_type in ("malicious", "all"):
            malicious_files = [
                "ofac_addresses.csv",
                "chainalysis_sanctions.csv",
                "tornado_cash.csv",
            ]
            for f in malicious_files:
                path = labels_dir / f
                if path.exists():
                    df = pd.read_csv(path)
                    df["label"] = 1
                    df["source"] = f.replace(".csv", "")
                    dfs.append(df)

        if label_type in ("normal", "all"):
            normal_files = ["known_exchanges.csv"]
            for f in normal_files:
                path = labels_dir / f
                if path.exists():
                    df = pd.read_csv(path)
                    df["label"] = 0
                    df["source"] = f.replace(".csv", "")
                    dfs.append(df)

        if not dfs:
            return pd.DataFrame(columns=["address", "label", "source"])

        return pd.concat(dfs, ignore_index=True)

    def _load_from_trino(self) -> pd.DataFrame:
        """Load features from Trino (Hudi)."""
        from trino.dbapi import connect

        cfg = self.config["data"]["trino"]
        conn = connect(
            host=cfg["host"],
            port=cfg["port"],
            catalog=cfg["catalog"],
            schema=cfg["schema"],
        )

        query = self._build_feature_query()
        return pd.read_sql(query, conn)

    def _load_from_postgres(self) -> pd.DataFrame:
        """Load features from PostgreSQL."""
        from sqlalchemy import create_engine

        cfg = self.config["data"]["postgres"]
        url = f"postgresql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{cfg['port']}/{cfg['database']}"
        engine = create_engine(url)

        query = self._build_feature_query()
        return pd.read_sql(query, engine)

    def _load_from_parquet(self) -> pd.DataFrame:
        """Load features from local Parquet file."""
        path = self.config["data"]["parquet"]["features_path"]
        return pd.read_parquet(path)

    def _build_feature_query(self) -> str:
        """Build SQL query for feature extraction."""
        features = self.config["features"]["list"]
        feature_cols = ", ".join(features)
        return f"SELECT address, {feature_cols} FROM address_features"

    def merge_features_labels(
        self,
        features: pd.DataFrame,
        labels: pd.DataFrame,
    ) -> pd.DataFrame:
        """Merge features with labels for supervised training."""
        merged = features.merge(
            labels[["address", "label"]],
            on="address",
            how="inner",
        )
        return merged

    def export_to_parquet(self, df: pd.DataFrame, output_path: str) -> None:
        """Export DataFrame to Parquet for local development."""
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(output_path, index=False)
        print(f"Exported {len(df)} rows to {output_path}")
