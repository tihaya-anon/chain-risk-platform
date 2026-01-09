"""Feature client for fetching precomputed features and graph data."""

import logging
from typing import Optional

import numpy as np

from app.core.config import get_config

log = logging.getLogger(__name__)

# V1 feature columns
FEATURE_COLUMNS = [
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


class FeatureClient:
    """Client for fetching features from Trino/PostgreSQL and graph from Neo4j."""

    def __init__(self):
        self.config = get_config()
        self._trino_conn = None
        self._neo4j_driver = None

    def _get_trino_connection(self):
        if self._trino_conn is None:
            from trino.dbapi import connect
            from trino.auth import BasicAuthentication

            cfg = self.config.trino
            self._trino_conn = connect(
                host=cfg.host,
                port=cfg.port,
                user=cfg.user,
                catalog=cfg.catalog,
                schema=cfg.schema,
                auth=BasicAuthentication(cfg.user, ""),
            )
        return self._trino_conn

    def _get_neo4j_driver(self):
        if self._neo4j_driver is None:
            from neo4j import GraphDatabase

            cfg = self.config.neo4j
            self._neo4j_driver = GraphDatabase.driver(
                cfg.uri, auth=(cfg.user, cfg.password)
            )
        return self._neo4j_driver

    async def get_features(
        self,
        address: str,
        network: str = "ethereum",
    ) -> Optional[dict]:
        """
        Get precomputed features for an address.

        Args:
            address: Ethereum address
            network: Network name

        Returns:
            Feature dictionary or None if not found
        """
        address = address.lower()

        try:
            conn = self._get_trino_connection()
            cursor = conn.cursor()

            query = f"""
            SELECT {', '.join(FEATURE_COLUMNS)}
            FROM address_features
            WHERE address = '{address}' AND network = '{network}'
            LIMIT 1
            """

            cursor.execute(query)
            row = cursor.fetchone()

            if not row:
                log.debug(f"No features found for {address}")
                return None

            features = dict(zip(FEATURE_COLUMNS, row))
            return features

        except Exception as e:
            log.error(f"Failed to fetch features for {address}: {e}")
            return None

    async def get_features_batch(
        self,
        addresses: list[str],
        network: str = "ethereum",
    ) -> dict[str, dict]:
        """Get features for multiple addresses."""
        addresses = [a.lower() for a in addresses]
        results = {}

        try:
            conn = self._get_trino_connection()
            cursor = conn.cursor()

            addr_list = ", ".join(f"'{a}'" for a in addresses)
            query = f"""
            SELECT address, {', '.join(FEATURE_COLUMNS)}
            FROM address_features
            WHERE address IN ({addr_list}) AND network = '{network}'
            """

            cursor.execute(query)
            rows = cursor.fetchall()

            for row in rows:
                addr = row[0]
                features = dict(zip(FEATURE_COLUMNS, row[1:]))
                results[addr] = features

        except Exception as e:
            log.error(f"Failed to fetch batch features: {e}")

        return results

    async def get_subgraph(
        self,
        address: str,
        network: str = "ethereum",
        hops: int = 2,
        max_neighbors: int = 50,
    ) -> Optional[dict]:
        """
        Get k-hop subgraph around an address from Neo4j.

        Args:
            address: Center address
            network: Network name
            hops: Number of hops
            max_neighbors: Max neighbors per hop

        Returns:
            Subgraph dict with nodes and edges
        """
        address = address.lower()

        try:
            driver = self._get_neo4j_driver()

            query = f"""
            MATCH path = (center:Address {{address: $address, network: $network}})
                         -[*1..{hops}]-(neighbor:Address)
            WITH center, neighbor, relationships(path) as rels
            LIMIT {max_neighbors * hops}
            RETURN DISTINCT 
                neighbor.address AS address,
                neighbor.tx_count AS tx_count
            """

            edge_query = f"""
            MATCH (a:Address {{network: $network}})-[t:TRANSFERRED_TO]->(b:Address {{network: $network}})
            WHERE a.address = $address OR b.address = $address
            RETURN a.address AS source, b.address AS target, 
                   toFloat(t.total_value) AS weight
            LIMIT {max_neighbors * 2}
            """

            with driver.session() as session:
                # Get neighbor nodes
                result = session.run(query, address=address, network=network)
                nodes = [{"address": address, "is_center": True}]
                for record in result:
                    nodes.append({
                        "address": record["address"],
                        "tx_count": record["tx_count"],
                        "is_center": False,
                    })

                # Get edges
                result = session.run(edge_query, address=address, network=network)
                edges = []
                for record in result:
                    edges.append({
                        "source": record["source"],
                        "target": record["target"],
                        "weight": record["weight"],
                    })

            if len(nodes) <= 1:
                log.debug(f"No subgraph found for {address}")
                return None

            return {"nodes": nodes, "edges": edges}

        except Exception as e:
            log.error(f"Failed to fetch subgraph for {address}: {e}")
            return None

    def close(self):
        """Close connections."""
        if self._trino_conn:
            self._trino_conn.close()
            self._trino_conn = None
        if self._neo4j_driver:
            self._neo4j_driver.close()
            self._neo4j_driver = None


def normalize_features(
    features: dict,
    norm_params: Optional[dict],
    method: str = "standard",
) -> np.ndarray:
    """
    Normalize feature dict to array.

    Args:
        features: Feature dictionary
        norm_params: Normalization parameters
        method: Normalization method

    Returns:
        Normalized feature array
    """
    values = []
    for col in FEATURE_COLUMNS:
        val = features.get(col, 0.0)
        if val is None or np.isnan(val) or np.isinf(val):
            val = 0.0

        if norm_params and col in norm_params:
            p = norm_params[col]
            if method == "standard":
                if p.get("std", 0) > 0:
                    val = (val - p["mean"]) / p["std"]
                else:
                    val = 0.0
            elif method == "minmax":
                if p.get("max", 0) > p.get("min", 0):
                    val = (val - p["min"]) / (p["max"] - p["min"])
                else:
                    val = 0.0

        values.append(val)

    return np.array(values, dtype=np.float32)
