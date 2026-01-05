"""Data loader for ML training pipeline.

Supports loading data from:
- Trino (Hudi tables) - Production
- PostgreSQL - Alternative
- Parquet files - Local development
"""

from pathlib import Path
from typing import Optional

import pandas as pd
import yaml


class DataLoader:
    """Load training data from Hudi via Trino."""

    def __init__(self, config_path: str = "configs/training_config.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)

    def load_training_data(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load training dataset (features + labels joined).
        
        This is the primary method for loading data for ML training.
        Uses the training_dataset table which contains pre-joined features and labels.
        """
        source = source or self.config["data"]["source"]

        if source == "trino":
            return self._load_training_from_trino()
        elif source == "postgres":
            return self._load_training_from_postgres()
        elif source == "parquet":
            return self._load_training_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    def load_features(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load feature data only (without labels)."""
        source = source or self.config["data"]["source"]

        if source == "trino":
            return self._load_features_from_trino()
        elif source == "postgres":
            return self._load_features_from_postgres()
        elif source == "parquet":
            return self._load_features_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    def load_labels(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load label data only."""
        source = source or self.config["data"]["source"]

        if source == "trino":
            return self._load_labels_from_trino()
        elif source == "parquet":
            return self._load_labels_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    # ==================== Trino Loaders ====================

    def _get_trino_connection(self):
        """Get Trino connection."""
        from trino.dbapi import connect

        cfg = self.config["data"]["trino"]
        return connect(
            host=cfg["host"],
            port=cfg["port"],
            catalog=cfg["catalog"],
            schema=cfg["schema"],
        )

    def _load_training_from_trino(self) -> pd.DataFrame:
        """Load training dataset from Hudi via Trino."""
        conn = self._get_trino_connection()
        
        feature_cols = self.config["features"]["list"]
        feature_cols_str = ", ".join(feature_cols)
        
        query = f"""
        SELECT 
            address,
            network,
            {feature_cols_str},
            label,
            label_type,
            label_source
        FROM training_dataset
        """
        
        df = pd.read_sql(query, conn)
        print(f"Loaded {len(df)} records from training_dataset")
        return df

    def _load_features_from_trino(self) -> pd.DataFrame:
        """Load features from Hudi via Trino."""
        conn = self._get_trino_connection()
        
        feature_cols = self.config["features"]["list"]
        feature_cols_str = ", ".join(feature_cols)
        
        query = f"""
        SELECT 
            address,
            network,
            {feature_cols_str}
        FROM address_features
        """
        
        return pd.read_sql(query, conn)

    def _load_labels_from_trino(self) -> pd.DataFrame:
        """Load labels from Hudi via Trino."""
        conn = self._get_trino_connection()
        
        query = """
        SELECT 
            address,
            label_type,
            label,
            source,
            confidence
        FROM address_labels
        """
        
        return pd.read_sql(query, conn)

    # ==================== PostgreSQL Loaders ====================

    def _get_postgres_engine(self):
        """Get PostgreSQL SQLAlchemy engine."""
        from sqlalchemy import create_engine

        cfg = self.config["data"]["postgres"]
        url = f"postgresql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{cfg['port']}/{cfg['database']}"
        return create_engine(url)

    def _load_training_from_postgres(self) -> pd.DataFrame:
        """Load training data from PostgreSQL (if synced)."""
        engine = self._get_postgres_engine()
        
        query = """
        SELECT * FROM risk.training_dataset
        """
        
        return pd.read_sql(query, engine)

    def _load_features_from_postgres(self) -> pd.DataFrame:
        """Load features from PostgreSQL."""
        engine = self._get_postgres_engine()
        
        query = """
        SELECT * FROM risk.address_features
        """
        
        return pd.read_sql(query, engine)

    # ==================== Parquet Loaders ====================

    def _load_training_from_parquet(self) -> pd.DataFrame:
        """Load training data from local Parquet file."""
        path = self.config["data"]["parquet"]["training_path"]
        return pd.read_parquet(path)

    def _load_features_from_parquet(self) -> pd.DataFrame:
        """Load features from local Parquet file."""
        path = self.config["data"]["parquet"]["features_path"]
        return pd.read_parquet(path)

    def _load_labels_from_parquet(self) -> pd.DataFrame:
        """Load labels from local Parquet/CSV files."""
        labels_dir = Path(self.config["data"]["parquet"]["labels_path"])
        dfs = []

        # Look for CSV or Parquet files
        for f in labels_dir.glob("*.csv"):
            df = pd.read_csv(f)
            if "source" not in df.columns:
                df["source"] = f.stem
            dfs.append(df)

        for f in labels_dir.glob("*.parquet"):
            df = pd.read_parquet(f)
            if "source" not in df.columns:
                df["source"] = f.stem
            dfs.append(df)

        if not dfs:
            return pd.DataFrame(columns=["address", "label_type", "source"])

        return pd.concat(dfs, ignore_index=True)

    # ==================== Utilities ====================

    def get_feature_columns(self) -> list[str]:
        """Get list of feature column names."""
        return self.config["features"]["list"]

    def prepare_training_arrays(
        self,
        df: pd.DataFrame,
        include_unlabeled: bool = False,
    ) -> tuple:
        """Prepare X, y arrays for sklearn training.
        
        Args:
            df: Training dataframe with features and label column
            include_unlabeled: If True, include rows with NULL labels (for semi-supervised)
        
        Returns:
            Tuple of (X, y, addresses) where:
            - X: Feature matrix (numpy array)
            - y: Label array (numpy array, may contain NaN if include_unlabeled=True)
            - addresses: Address list for reference
        """
        import numpy as np

        feature_cols = self.get_feature_columns()
        
        # Filter to labeled data only (unless include_unlabeled)
        if not include_unlabeled:
            df = df[df["label"].notna()]
        
        if len(df) == 0:
            raise ValueError("No data available for training")
        
        X = df[feature_cols].fillna(0).values
        y = df["label"].values
        addresses = df["address"].values
        
        # Replace inf with 0
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        
        return X, y, addresses

    def export_to_parquet(self, df: pd.DataFrame, output_path: str) -> None:
        """Export DataFrame to Parquet for local development."""
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(output_path, index=False)
        print(f"Exported {len(df)} rows to {output_path}")
