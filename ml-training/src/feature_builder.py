"""Feature builder for computing address features.

This module defines feature computation logic that can be used both in:
- Spark batch jobs (FeatureComputeJob.java calls this logic)
- Local Python training pipeline
"""

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd


@dataclass
class FeatureConfig:
    """Feature computation configuration."""
    small_tx_threshold: float = 0.01  # ETH
    large_tx_threshold: float = 10.0  # ETH
    wei_to_eth: float = 1e18


class FeatureBuilder:
    """Build features from raw transfer data."""

    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()

    def compute_features(self, transfers: pd.DataFrame) -> pd.DataFrame:
        """Compute all V1 features from transfer data.
        
        Args:
            transfers: DataFrame with columns:
                - from_address, to_address, value, timestamp, tx_hash
        
        Returns:
            DataFrame with one row per address and feature columns.
        """
        # Get unique addresses (both senders and receivers)
        all_addresses = pd.concat([
            transfers["from_address"],
            transfers["to_address"],
        ]).unique()

        features_list = []
        for addr in all_addresses:
            features = self._compute_address_features(addr, transfers)
            features_list.append(features)

        return pd.DataFrame(features_list)

    def _compute_address_features(
        self,
        address: str,
        transfers: pd.DataFrame,
    ) -> dict:
        """Compute features for a single address."""
        sent = transfers[transfers["from_address"] == address]
        received = transfers[transfers["to_address"] == address]
        all_tx = pd.concat([sent, received])

        # Convert value to ETH
        sent_values = sent["value"].astype(float) / self.config.wei_to_eth
        received_values = received["value"].astype(float) / self.config.wei_to_eth
        all_values = all_tx["value"].astype(float) / self.config.wei_to_eth

        # Basic counts
        tx_count = len(all_tx)
        sent_count = len(sent)
        received_count = len(received)

        # Unique counterparties
        sent_counterparties = set(sent["to_address"].unique())
        received_counterparties = set(received["from_address"].unique())
        unique_counterparties = len(sent_counterparties | received_counterparties)

        # Value statistics
        avg_tx_value = all_values.mean() if len(all_values) > 0 else 0
        max_tx_value = all_values.max() if len(all_values) > 0 else 0
        tx_value_stddev = all_values.std() if len(all_values) > 1 else 0

        # Time features
        if len(all_tx) > 0:
            timestamps = pd.to_datetime(all_tx["timestamp"])
            first_seen = timestamps.min()
            last_seen = timestamps.max()
            address_age_days = (last_seen - first_seen).days
        else:
            address_age_days = 0

        # Ratio features
        sent_ratio = sent_count / tx_count if tx_count > 0 else 0

        # Amount pattern features
        if len(all_values) > 0:
            round_amounts = all_values.apply(lambda x: x == int(x) if x > 0 else False)
            round_amount_ratio = round_amounts.sum() / len(all_values)

            small_tx = all_values < self.config.small_tx_threshold
            small_tx_ratio = small_tx.sum() / len(all_values)

            large_tx = all_values > self.config.large_tx_threshold
            large_tx_ratio = large_tx.sum() / len(all_values)
        else:
            round_amount_ratio = 0
            small_tx_ratio = 0
            large_tx_ratio = 0

        # Graph features (from transfer data, not Neo4j)
        in_degree = len(received)
        out_degree = len(sent)
        in_out_ratio = in_degree / out_degree if out_degree > 0 else float("inf")
        unique_in_neighbors = len(received_counterparties)

        return {
            "address": address,
            "tx_count": tx_count,
            "sent_count": sent_count,
            "received_count": received_count,
            "unique_counterparties": unique_counterparties,
            "avg_tx_value": avg_tx_value,
            "max_tx_value": max_tx_value,
            "tx_value_stddev": tx_value_stddev,
            "address_age_days": address_age_days,
            "sent_ratio": sent_ratio,
            "round_amount_ratio": round_amount_ratio,
            "small_tx_ratio": small_tx_ratio,
            "large_tx_ratio": large_tx_ratio,
            "in_degree": in_degree,
            "out_degree": out_degree,
            "in_out_ratio": in_out_ratio if in_out_ratio != float("inf") else -1,
            "unique_in_neighbors": unique_in_neighbors,
        }

    def compute_features_sql(self) -> str:
        """Generate SQL for feature computation (Spark/Trino).
        
        Returns SQL that can be executed against transfers table.
        """
        return """
        WITH address_stats AS (
            SELECT 
                address,
                COUNT(*) as tx_count,
                SUM(CASE WHEN is_sender THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN NOT is_sender THEN 1 ELSE 0 END) as received_count,
                COUNT(DISTINCT counterparty) as unique_counterparties,
                AVG(value_eth) as avg_tx_value,
                MAX(value_eth) as max_tx_value,
                STDDEV(value_eth) as tx_value_stddev,
                DATE_DIFF('day', MIN(timestamp), MAX(timestamp)) as address_age_days
            FROM (
                SELECT 
                    from_address as address,
                    to_address as counterparty,
                    CAST(value AS DOUBLE) / 1e18 as value_eth,
                    timestamp,
                    TRUE as is_sender
                FROM transfers
                UNION ALL
                SELECT 
                    to_address as address,
                    from_address as counterparty,
                    CAST(value AS DOUBLE) / 1e18 as value_eth,
                    timestamp,
                    FALSE as is_sender
                FROM transfers
            )
            GROUP BY address
        )
        SELECT 
            address,
            tx_count,
            sent_count,
            received_count,
            unique_counterparties,
            avg_tx_value,
            max_tx_value,
            COALESCE(tx_value_stddev, 0) as tx_value_stddev,
            address_age_days,
            CAST(sent_count AS DOUBLE) / tx_count as sent_ratio,
            sent_count as out_degree,
            received_count as in_degree,
            CASE WHEN sent_count > 0 
                THEN CAST(received_count AS DOUBLE) / sent_count 
                ELSE -1 
            END as in_out_ratio
        FROM address_stats
        """


class Neo4jFeatureBuilder:
    """Build graph features from Neo4j using Cypher queries."""

    def __init__(self, uri: str, user: str, password: str):
        from neo4j import GraphDatabase
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def get_graph_features(self, addresses: list[str]) -> pd.DataFrame:
        """Get graph features for a list of addresses."""
        query = """
        UNWIND $addresses AS addr
        MATCH (a:Address {address: addr})
        OPTIONAL MATCH (a)<-[:TRANSFER]-(sender)
        OPTIONAL MATCH (a)-[:TRANSFER]->(receiver)
        RETURN 
            a.address AS address,
            COUNT(DISTINCT sender) AS unique_in_neighbors,
            COUNT(DISTINCT receiver) AS unique_out_neighbors,
            COALESCE(a.pagerank, 0) AS pagerank,
            COALESCE(a.cluster_id, -1) AS cluster_id
        """
        with self.driver.session() as session:
            result = session.run(query, addresses=addresses)
            return pd.DataFrame([dict(r) for r in result])

    def get_blacklist_distance(
        self,
        addresses: list[str],
        max_hops: int = 3,
    ) -> pd.DataFrame:
        """Get minimum distance to blacklisted addresses."""
        query = """
        UNWIND $addresses AS addr
        MATCH (a:Address {address: addr})
        OPTIONAL MATCH path = shortestPath(
            (a)-[:TRANSFER*1..%d]-(b:Address)
        )
        WHERE b.is_blacklisted = true
        RETURN 
            a.address AS address,
            CASE WHEN path IS NULL THEN -1 ELSE length(path) END AS hops_to_blacklist
        """ % max_hops

        with self.driver.session() as session:
            result = session.run(query, addresses=addresses)
            return pd.DataFrame([dict(r) for r in result])
