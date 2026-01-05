"""Data loader for ML training pipeline."""

from pathlib import Path
from typing import Optional

import pandas as pd
import yaml

from log_config import get_logger

log = get_logger("data_loader")


class DataLoader:
    """Load training data from Hudi via Trino."""

    def __init__(self, config_path: str = "configs/training_config.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        log.debug(f"Loaded config from {config_path}")

    def load_training_data(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load training dataset (features + labels joined)."""
        source = source or self.config["data"]["source"]
        log.info(f"Loading training data from {source}")

        if source == "trino":
            return self._load_training_from_trino()
        elif source == "postgres":
            return self._load_training_from_postgres()
        elif source == "parquet":
            return self._load_training_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    def load_features(self, source: Optional[str] = None) -> pd.DataFrame:
        """Load feature data only."""
        source = source or self.config["data"]["source"]
        log.info(f"Loading features from {source}")

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
        log.info(f"Loading labels from {source}")

        if source == "trino":
            return self._load_labels_from_trino()
        elif source == "parquet":
            return self._load_labels_from_parquet()
        else:
            raise ValueError(f"Unknown data source: {source}")

    # ==================== Trino ====================

    def _get_trino_connection(self):
        from trino.dbapi import connect

        cfg = self.config["data"]["trino"]
        log.debug(f"Connecting to Trino at {cfg['host']}:{cfg['port']}")
        return connect(
            host=cfg["host"],
            port=cfg["port"],
            catalog=cfg["catalog"],
            schema=cfg["schema"],
        )

    def _load_training_from_trino(self) -> pd.DataFrame:
        conn = self._get_trino_connection()
        feature_cols = ", ".join(self.config["features"]["list"])
        
        query = f"""
        SELECT address, network, {feature_cols}, label, label_type, label_source
        FROM training_dataset
        """
        
        df = pd.read_sql(query, conn)
        log.info(f"Loaded {len(df)} records from training_dataset")
        return df

    def _load_features_from_trino(self) -> pd.DataFrame:
        conn = self._get_trino_connection()
        feature_cols = ", ".join(self.config["features"]["list"])
        
        query = f"SELECT address, network, {feature_cols} FROM address_features"
        df = pd.read_sql(query, conn)
        log.info(f"Loaded {len(df)} feature records")
        return df

    def _load_labels_from_trino(self) -> pd.DataFrame:
        conn = self._get_trino_connection()
        
        query = "SELECT address, label_type, label, source, confidence FROM address_labels"
        df = pd.read_sql(query, conn)
        log.info(f"Loaded {len(df)} label records")
        return df

    # ==================== PostgreSQL ====================

    def _get_postgres_engine(self):
        from sqlalchemy import create_engine

        cfg = self.config["data"]["postgres"]
        url = f"postgresql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{cfg['port']}/{cfg['database']}"
        return create_engine(url)

    def _load_training_from_postgres(self) -> pd.DataFrame:
        engine = self._get_postgres_engine()
        df = pd.read_sql("SELECT * FROM risk.training_dataset", engine)
        log.info(f"Loaded {len(df)} records from PostgreSQL")
        return df

    def _load_features_from_postgres(self) -> pd.DataFrame:
        engine = self._get_postgres_engine()
        return pd.read_sql("SELECT * FROM risk.address_features", engine)

    # ==================== Parquet ====================

    def _load_training_from_parquet(self) -> pd.DataFrame:
        path = self.config["data"]["parquet"]["training_path"]
        df = pd.read_parquet(path)
        log.info(f"Loaded {len(df)} records from {path}")
        return df

    def _load_features_from_parquet(self) -> pd.DataFrame:
        path = self.config["data"]["parquet"]["features_path"]
        return pd.read_parquet(path)

    def _load_labels_from_parquet(self) -> pd.DataFrame:
        labels_dir = Path(self.config["data"]["parquet"]["labels_path"])
        dfs = []

        for f in labels_dir.glob("*.csv"):
            df = pd.read_csv(f)
            if "source" not in df.columns:
                df["source"] = f.stem
            dfs.append(df)
            log.debug(f"Loaded {len(df)} labels from {f}")

        for f in labels_dir.glob("*.parquet"):
            df = pd.read_parquet(f)
            if "source" not in df.columns:
                df["source"] = f.stem
            dfs.append(df)

        if not dfs:
            log.warning("No label files found")
            return pd.DataFrame(columns=["address", "label_type", "source"])

        return pd.concat(dfs, ignore_index=True)

    # ==================== Utilities ====================

    def get_feature_columns(self) -> list[str]:
        return self.config["features"]["list"]

    def prepare_training_arrays(
        self,
        df: pd.DataFrame,
        include_unlabeled: bool = False,
    ) -> tuple:
        """Prepare X, y arrays for sklearn training."""
        import numpy as np

        feature_cols = self.get_feature_columns()
        
        if not include_unlabeled:
            df = df[df["label"].notna()]
        
        if len(df) == 0:
            raise ValueError("No data available for training")
        
        X = df[feature_cols].fillna(0).values
        y = df["label"].values
        addresses = df["address"].values
        
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        
        log.debug(f"Prepared arrays: X={X.shape}, y={y.shape}")
        return X, y, addresses

    def export_to_parquet(self, df: pd.DataFrame, output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(output_path, index=False)
        log.info(f"Exported {len(df)} rows to {output_path}")
