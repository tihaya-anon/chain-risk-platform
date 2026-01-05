"""Feature builder for computing address features."""

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from log_config import get_logger

log = get_logger("feature_builder")


@dataclass
class FeatureConfig:
    """Feature computation configuration."""
    small_tx_threshold: float = 0.01
    large_tx_threshold: float = 10.0
    wei_to_eth: float = 1e18


class FeatureBuilder:
    """Build features from raw transfer data."""

    def __init__(self, config: Optional[FeatureConfig] = None):
        self.config = config or FeatureConfig()

    def compute_features(self, transfers: pd.DataFrame) -> pd.DataFrame:
        """Compute all V1 features from transfer data."""
        all_addresses = pd.concat([
            transfers["from_address"],
            transfers["to_address"],
        ]).unique()

        log.info(f"Computing features for {len(all_addresses)} addresses")
        
        features_list = []
        for i, addr in enumerate(all_addresses):
            if (i + 1) % 1000 == 0:
                log.debug(f"Progress: {i + 1}/{len(all_addresses)}")
            features = self._compute_address_features(addr, transfers)
            features_list.append(features)

        log.info(f"Computed {len(features_list)} feature records")
        return pd.DataFrame(features_list)

    def _compute_address_features(self, address: str, transfers: pd.DataFrame) -> dict:
        """Compute features for a single address."""
        sent = transfers[transfers["from_address"] == address]
        received = transfers[transfers["to_address"] == address]
        all_tx = pd.concat([sent, received])

        sent_values = sent["value"].astype(float) / self.config.wei_to_eth
        received_values = received["value"].astype(float) / self.config.wei_to_eth
        all_values = all_tx["value"].astype(float) / self.config.wei_to_eth

        tx_count = len(all_tx)
        sent_count = len(sent)
        received_count = len(received)

        sent_counterparties = set(sent["to_address"].unique())
        received_counterparties = set(received["from_address"].unique())
        unique_counterparties = len(sent_counterparties | received_counterparties)

        avg_tx_value = all_values.mean() if len(all_values) > 0 else 0
        max_tx_value = all_values.max() if len(all_values) > 0 else 0
        tx_value_stddev = all_values.std() if len(all_values) > 1 else 0

        if len(all_tx) > 0:
            timestamps = pd.to_datetime(all_tx["timestamp"])
            address_age_days = (timestamps.max() - timestamps.min()).days
        else:
            address_age_days = 0

        sent_ratio = sent_count / tx_count if tx_count > 0 else 0

        if len(all_values) > 0:
            round_amounts = all_values.apply(lambda x: x == int(x) if x > 0 else False)
            round_amount_ratio = round_amounts.sum() / len(all_values)
            small_tx_ratio = (all_values < self.config.small_tx_threshold).sum() / len(all_values)
            large_tx_ratio = (all_values > self.config.large_tx_threshold).sum() / len(all_values)
        else:
            round_amount_ratio = small_tx_ratio = large_tx_ratio = 0

        in_degree = len(received)
        out_degree = len(sent)
        in_out_ratio = in_degree / out_degree if out_degree > 0 else -1
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
            "in_out_ratio": in_out_ratio,
            "unique_in_neighbors": unique_in_neighbors,
        }


class Neo4jFeatureBuilder:
    """Build graph features from Neo4j."""

    def __init__(self, uri: str, user: str, password: str):
        from neo4j import GraphDatabase
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        log.debug(f"Connected to Neo4j at {uri}")

    def close(self):
        self.driver.close()

    def get_graph_features(self, addresses: list[str]) -> pd.DataFrame:
        """Get graph features for addresses."""
        log.info(f"Fetching graph features for {len(addresses)} addresses")
        
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
            df = pd.DataFrame([dict(r) for r in result])
        
        log.debug(f"Retrieved {len(df)} graph feature records")
        return df

    def get_blacklist_distance(self, addresses: list[str], max_hops: int = 3) -> pd.DataFrame:
        """Get minimum distance to blacklisted addresses."""
        log.info(f"Computing blacklist distance for {len(addresses)} addresses")
        
        query = f"""
        UNWIND $addresses AS addr
        MATCH (a:Address {{address: addr}})
        OPTIONAL MATCH path = shortestPath(
            (a)-[:TRANSFER*1..{max_hops}]-(b:Address)
        )
        WHERE b.is_blacklisted = true
        RETURN 
            a.address AS address,
            CASE WHEN path IS NULL THEN -1 ELSE length(path) END AS hops_to_blacklist
        """
        with self.driver.session() as session:
            result = session.run(query, addresses=addresses)
            return pd.DataFrame([dict(r) for r in result])
