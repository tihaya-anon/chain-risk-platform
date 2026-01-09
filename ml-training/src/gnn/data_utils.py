"""Data utilities for GNN training."""

import logging
from typing import Optional

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

# V1 feature columns (16 features)
FEATURE_COLUMNS_V1 = [
    "tx_count",
    "sent_count",
    "received_count",
    "unique_counterparties",
    "avg_tx_value",
    "max_tx_value",
    "tx_value_stddev",
    "address_age_days",
    "sent_ratio",
    "round_amount_ratio",
    "small_tx_ratio",
    "large_tx_ratio",
    "in_degree",
    "out_degree",
    "in_out_ratio",
    "unique_in_neighbors",
]


class DataUtils:
    """Utilities for data preprocessing and splitting."""

    @staticmethod
    def get_feature_columns(version: str = "v1") -> list[str]:
        """Get feature column names for a version."""
        if version == "v1":
            return FEATURE_COLUMNS_V1
        raise ValueError(f"Unknown feature version: {version}")

    @staticmethod
    def normalize_features(
        df: pd.DataFrame,
        feature_cols: list[str],
        method: str = "standard",
    ) -> tuple[pd.DataFrame, dict]:
        """
        Normalize feature columns.

        Args:
            df: DataFrame with features
            feature_cols: Columns to normalize
            method: 'standard' (z-score) or 'minmax'

        Returns:
            Normalized DataFrame and normalization params
        """
        df = df.copy()
        params = {}

        available_cols = [c for c in feature_cols if c in df.columns]

        for col in available_cols:
            values = df[col].fillna(0).replace([np.inf, -np.inf], 0)

            if method == "standard":
                mean = values.mean()
                std = values.std()
                if std > 0:
                    df[col] = (values - mean) / std
                else:
                    df[col] = 0.0
                params[col] = {"mean": mean, "std": std}

            elif method == "minmax":
                min_val = values.min()
                max_val = values.max()
                if max_val > min_val:
                    df[col] = (values - min_val) / (max_val - min_val)
                else:
                    df[col] = 0.0
                params[col] = {"min": min_val, "max": max_val}

        return df, params

    @staticmethod
    def apply_normalization(
        df: pd.DataFrame,
        params: dict,
        method: str = "standard",
    ) -> pd.DataFrame:
        """Apply saved normalization params to new data."""
        df = df.copy()

        for col, p in params.items():
            if col not in df.columns:
                continue

            values = df[col].fillna(0).replace([np.inf, -np.inf], 0)

            if method == "standard":
                if p["std"] > 0:
                    df[col] = (values - p["mean"]) / p["std"]
                else:
                    df[col] = 0.0
            elif method == "minmax":
                if p["max"] > p["min"]:
                    df[col] = (values - p["min"]) / (p["max"] - p["min"])
                else:
                    df[col] = 0.0

        return df

    @staticmethod
    def create_node_masks(
        num_nodes: int,
        labels: Optional[np.ndarray],
        train_ratio: float = 0.6,
        val_ratio: float = 0.2,
        test_ratio: float = 0.2,
        random_state: int = 42,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Create train/val/test masks for node classification.

        Only labeled nodes are split; unlabeled nodes have all masks as False.

        Args:
            num_nodes: Total number of nodes
            labels: Node labels array (None/NaN for unlabeled)
            train_ratio: Training set ratio
            val_ratio: Validation set ratio
            test_ratio: Test set ratio
            random_state: Random seed

        Returns:
            train_mask, val_mask, test_mask (boolean arrays)
        """
        assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6

        rng = np.random.RandomState(random_state)

        train_mask = np.zeros(num_nodes, dtype=bool)
        val_mask = np.zeros(num_nodes, dtype=bool)
        test_mask = np.zeros(num_nodes, dtype=bool)

        if labels is None:
            return train_mask, val_mask, test_mask

        # Find labeled indices
        labeled_idx = np.where(~np.isnan(labels.astype(float)))[0]

        if len(labeled_idx) == 0:
            return train_mask, val_mask, test_mask

        # Shuffle labeled indices
        rng.shuffle(labeled_idx)

        n_labeled = len(labeled_idx)
        n_train = int(n_labeled * train_ratio)
        n_val = int(n_labeled * val_ratio)

        train_idx = labeled_idx[:n_train]
        val_idx = labeled_idx[n_train : n_train + n_val]
        test_idx = labeled_idx[n_train + n_val :]

        train_mask[train_idx] = True
        val_mask[val_idx] = True
        test_mask[test_idx] = True

        log.info(
            f"Split: train={len(train_idx)}, val={len(val_idx)}, "
            f"test={len(test_idx)}, unlabeled={num_nodes - n_labeled}"
        )

        return train_mask, val_mask, test_mask

    @staticmethod
    def create_stratified_masks(
        num_nodes: int,
        labels: np.ndarray,
        train_ratio: float = 0.6,
        val_ratio: float = 0.2,
        test_ratio: float = 0.2,
        random_state: int = 42,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Create stratified train/val/test masks preserving class distribution.

        Args:
            num_nodes: Total number of nodes
            labels: Node labels array
            train_ratio: Training set ratio
            val_ratio: Validation set ratio
            test_ratio: Test set ratio
            random_state: Random seed

        Returns:
            train_mask, val_mask, test_mask (boolean arrays)
        """
        from sklearn.model_selection import train_test_split

        train_mask = np.zeros(num_nodes, dtype=bool)
        val_mask = np.zeros(num_nodes, dtype=bool)
        test_mask = np.zeros(num_nodes, dtype=bool)

        # Find labeled indices
        labeled_mask = ~np.isnan(labels.astype(float))
        labeled_idx = np.where(labeled_mask)[0]
        labeled_labels = labels[labeled_idx]

        if len(labeled_idx) < 10:
            log.warning("Too few labeled samples for stratified split, using random split")
            return DataUtils.create_node_masks(
                num_nodes, labels, train_ratio, val_ratio, test_ratio, random_state
            )

        # Check class distribution
        unique, counts = np.unique(labeled_labels, return_counts=True)
        min_count = counts.min()

        if min_count < 3:
            log.warning("Minority class too small, using random split")
            return DataUtils.create_node_masks(
                num_nodes, labels, train_ratio, val_ratio, test_ratio, random_state
            )

        # First split: train vs (val+test)
        train_idx, temp_idx, _, temp_labels = train_test_split(
            labeled_idx,
            labeled_labels,
            train_size=train_ratio,
            random_state=random_state,
            stratify=labeled_labels,
        )

        # Second split: val vs test
        val_size = val_ratio / (val_ratio + test_ratio)
        val_idx, test_idx = train_test_split(
            temp_idx,
            train_size=val_size,
            random_state=random_state,
            stratify=temp_labels,
        )

        train_mask[train_idx] = True
        val_mask[val_idx] = True
        test_mask[test_idx] = True

        log.info(
            f"Stratified split: train={len(train_idx)}, val={len(val_idx)}, test={len(test_idx)}"
        )

        return train_mask, val_mask, test_mask

    @staticmethod
    def compute_class_weights(labels: np.ndarray) -> dict[int, float]:
        """
        Compute class weights for imbalanced classification.

        Args:
            labels: Array of labels

        Returns:
            Dictionary mapping class to weight
        """
        valid_labels = labels[~np.isnan(labels.astype(float))]
        unique, counts = np.unique(valid_labels, return_counts=True)

        total = len(valid_labels)
        n_classes = len(unique)

        weights = {}
        for cls, count in zip(unique, counts):
            weights[int(cls)] = total / (n_classes * count)

        log.info(f"Class weights: {weights}")
        return weights

    @staticmethod
    def get_feature_matrix(
        nodes_df: pd.DataFrame,
        feature_cols: list[str],
        fillna: float = 0.0,
    ) -> np.ndarray:
        """
        Extract feature matrix from nodes DataFrame.

        Args:
            nodes_df: DataFrame with node features
            feature_cols: Feature columns to extract
            fillna: Value to fill NaN

        Returns:
            Feature matrix (num_nodes, num_features)
        """
        available = [c for c in feature_cols if c in nodes_df.columns]
        missing = [c for c in feature_cols if c not in nodes_df.columns]

        if missing:
            log.warning(f"Missing features: {missing}")

        X = nodes_df[available].fillna(fillna).replace([np.inf, -np.inf], fillna).values

        # Add zero columns for missing features
        if missing:
            zeros = np.zeros((len(nodes_df), len(missing)))
            X = np.hstack([X, zeros])

        return X.astype(np.float32)

    @staticmethod
    def get_edge_index(
        edges_df: pd.DataFrame,
        node_to_idx: dict[str, int],
    ) -> np.ndarray:
        """
        Convert edge DataFrame to edge index array.

        Args:
            edges_df: DataFrame with source, target columns
            node_to_idx: Mapping from address to node index

        Returns:
            Edge index array (2, num_edges)
        """
        sources = edges_df["source"].map(node_to_idx).values
        targets = edges_df["target"].map(node_to_idx).values

        # Filter out edges with unknown nodes
        valid = ~(np.isnan(sources) | np.isnan(targets))
        sources = sources[valid].astype(np.int64)
        targets = targets[valid].astype(np.int64)

        edge_index = np.stack([sources, targets], axis=0)
        return edge_index

    @staticmethod
    def get_labels_array(
        nodes_df: pd.DataFrame,
        labels_df: Optional[pd.DataFrame],
    ) -> np.ndarray:
        """
        Create labels array aligned with nodes.

        Args:
            nodes_df: DataFrame with address column
            labels_df: DataFrame with address, label columns

        Returns:
            Labels array (num_nodes,) with NaN for unlabeled
        """
        labels = np.full(len(nodes_df), np.nan, dtype=np.float32)

        if labels_df is None or labels_df.empty:
            return labels

        addr_to_idx = {addr: i for i, addr in enumerate(nodes_df["address"])}

        for _, row in labels_df.iterrows():
            addr = row["address"]
            if addr in addr_to_idx:
                labels[addr_to_idx[addr]] = row["label"]

        labeled_count = np.sum(~np.isnan(labels))
        log.info(f"Labels: {labeled_count}/{len(labels)} nodes labeled")

        return labels
