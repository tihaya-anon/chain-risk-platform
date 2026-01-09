"""Graph data builder for loading graph from Neo4j and features from Trino/Hudi."""

import logging
from dataclasses import dataclass, field
from typing import Optional

import networkx as nx
import numpy as np
import pandas as pd
from neo4j import GraphDatabase

log = logging.getLogger(__name__)


@dataclass
class GraphData:
    """Container for graph data before PyG conversion."""

    nodes: pd.DataFrame  # address, features...
    edges: pd.DataFrame  # source, target, weight...
    node_labels: Optional[pd.DataFrame] = None  # address, label
    node_to_idx: dict = field(default_factory=dict)
    idx_to_node: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.node_to_idx:
            self.node_to_idx = {addr: i for i, addr in enumerate(self.nodes["address"])}
            self.idx_to_node = {i: addr for addr, i in self.node_to_idx.items()}

    @property
    def num_nodes(self) -> int:
        return len(self.nodes)

    @property
    def num_edges(self) -> int:
        return len(self.edges)

    def to_networkx(self) -> nx.DiGraph:
        """Convert to NetworkX DiGraph."""
        G = nx.DiGraph()
        for _, row in self.nodes.iterrows():
            G.add_node(row["address"], **row.to_dict())
        for _, row in self.edges.iterrows():
            G.add_edge(row["source"], row["target"], weight=row.get("weight", 1.0))
        return G


class GraphBuilder:
    """Build graph data from Neo4j and Hudi/Trino."""

    def __init__(
        self,
        neo4j_uri: str,
        neo4j_user: str,
        neo4j_password: str,
        trino_host: str = "localhost",
        trino_port: int = 18081,
        trino_user: str = "admin",
        trino_catalog: str = "hudi",
        trino_schema: str = "chainrisk",
    ):
        self.neo4j_uri = neo4j_uri
        self.neo4j_user = neo4j_user
        self.neo4j_password = neo4j_password
        self.trino_host = trino_host
        self.trino_port = trino_port
        self.trino_user = trino_user
        self.trino_catalog = trino_catalog
        self.trino_schema = trino_schema

        self._neo4j_driver = None
        self._trino_conn = None

    def _get_neo4j_driver(self):
        if self._neo4j_driver is None:
            self._neo4j_driver = GraphDatabase.driver(
                self.neo4j_uri, auth=(self.neo4j_user, self.neo4j_password)
            )
        return self._neo4j_driver

    def _get_trino_connection(self):
        if self._trino_conn is None:
            from trino.dbapi import connect
            from trino.auth import BasicAuthentication

            self._trino_conn = connect(
                host=self.trino_host,
                port=self.trino_port,
                user=self.trino_user,
                catalog=self.trino_catalog,
                schema=self.trino_schema,
                auth=BasicAuthentication(self.trino_user, ""),
            )
        return self._trino_conn

    def close(self):
        """Close all connections."""
        if self._neo4j_driver:
            self._neo4j_driver.close()
            self._neo4j_driver = None
        if self._trino_conn:
            self._trino_conn.close()
            self._trino_conn = None

    def load_graph_from_neo4j(
        self,
        network: str = "ethereum",
        limit: Optional[int] = None,
        min_tx_count: int = 1,
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Load graph structure from Neo4j.

        Returns:
            nodes_df: DataFrame with address column
            edges_df: DataFrame with source, target, weight columns
        """
        driver = self._get_neo4j_driver()

        # Query nodes (addresses with transactions)
        node_query = """
        MATCH (a:Address {network: $network})
        WHERE a.tx_count >= $min_tx_count
        RETURN a.address AS address, a.network AS network
        """ + (f"LIMIT {limit}" if limit else "")

        # Query edges (transfers)
        edge_query = """
        MATCH (from:Address {network: $network})-[t:TRANSFERRED_TO]->(to:Address {network: $network})
        WHERE from.tx_count >= $min_tx_count OR to.tx_count >= $min_tx_count
        RETURN from.address AS source, to.address AS target, 
               toFloat(t.total_value) AS weight, toInteger(t.tx_count) AS tx_count
        """ + (f"LIMIT {limit * 10}" if limit else "")

        with driver.session() as session:
            log.info("Loading nodes from Neo4j...")
            nodes_result = session.run(node_query, network=network, min_tx_count=min_tx_count)
            nodes_data = [dict(record) for record in nodes_result]
            nodes_df = pd.DataFrame(nodes_data)
            log.info(f"Loaded {len(nodes_df)} nodes")

            log.info("Loading edges from Neo4j...")
            edges_result = session.run(edge_query, network=network, min_tx_count=min_tx_count)
            edges_data = [dict(record) for record in edges_result]
            edges_df = pd.DataFrame(edges_data)
            log.info(f"Loaded {len(edges_df)} edges")

        return nodes_df, edges_df

    def load_features_from_trino(
        self,
        addresses: Optional[list[str]] = None,
        feature_version: str = "v1",
    ) -> pd.DataFrame:
        """
        Load precomputed features from Hudi via Trino.

        Args:
            addresses: Optional list of addresses to filter
            feature_version: Feature version to load

        Returns:
            DataFrame with address and feature columns
        """
        conn = self._get_trino_connection()
        cursor = conn.cursor()

        feature_cols = [
            "address",
            "network",
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

        query = f"""
        SELECT {', '.join(feature_cols)}
        FROM address_features
        WHERE feature_version = '{feature_version}'
        """

        if addresses:
            addr_list = ", ".join(f"'{a}'" for a in addresses)
            query += f" AND address IN ({addr_list})"

        log.info("Loading features from Trino...")
        cursor.execute(query)
        rows = cursor.fetchall()
        df = pd.DataFrame(rows, columns=feature_cols)
        log.info(f"Loaded features for {len(df)} addresses")

        return df

    def load_labels_from_trino(self) -> pd.DataFrame:
        """
        Load labels from Hudi via Trino.

        Returns:
            DataFrame with address, label columns (1=risky, 0=normal)
        """
        conn = self._get_trino_connection()
        cursor = conn.cursor()

        query = """
        SELECT address,
               CASE 
                   WHEN label_type IN ('sanctioned', 'mixer') THEN 1
                   WHEN label_type = 'exchange' THEN 0
                   ELSE NULL
               END AS label,
               label_type,
               source
        FROM address_labels
        """

        log.info("Loading labels from Trino...")
        cursor.execute(query)
        rows = cursor.fetchall()
        df = pd.DataFrame(rows, columns=["address", "label", "label_type", "source"])
        df = df[df["label"].notna()]
        log.info(f"Loaded {len(df)} labeled addresses")

        return df

    def build_graph_data(
        self,
        network: str = "ethereum",
        limit: Optional[int] = None,
        min_tx_count: int = 1,
        feature_version: str = "v1",
        include_labels: bool = True,
    ) -> GraphData:
        """
        Build complete graph data with features and labels.

        Args:
            network: Blockchain network
            limit: Limit number of nodes (for testing)
            min_tx_count: Minimum transaction count filter
            feature_version: Feature version to load
            include_labels: Whether to include labels

        Returns:
            GraphData object
        """
        # Load graph structure
        nodes_df, edges_df = self.load_graph_from_neo4j(
            network=network, limit=limit, min_tx_count=min_tx_count
        )

        if nodes_df.empty:
            raise ValueError("No nodes found in Neo4j")

        # Load features
        addresses = nodes_df["address"].tolist()
        features_df = self.load_features_from_trino(
            addresses=addresses, feature_version=feature_version
        )

        # Merge nodes with features
        nodes_df = nodes_df.merge(features_df, on=["address", "network"], how="left")

        # Filter edges to only include known nodes
        known_addresses = set(nodes_df["address"])
        edges_df = edges_df[
            edges_df["source"].isin(known_addresses) & edges_df["target"].isin(known_addresses)
        ]

        # Load labels if requested
        labels_df = None
        if include_labels:
            labels_df = self.load_labels_from_trino()
            labels_df = labels_df[labels_df["address"].isin(known_addresses)]

        log.info(
            f"Built graph: {len(nodes_df)} nodes, {len(edges_df)} edges, "
            f"{len(labels_df) if labels_df is not None else 0} labels"
        )

        return GraphData(nodes=nodes_df, edges=edges_df, node_labels=labels_df)

    def export_to_files(
        self,
        graph_data: GraphData,
        output_dir: str,
        prefix: str = "graph",
    ):
        """Export graph data to parquet files."""
        from pathlib import Path

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        graph_data.nodes.to_parquet(output_path / f"{prefix}_nodes.parquet", index=False)
        graph_data.edges.to_parquet(output_path / f"{prefix}_edges.parquet", index=False)
        if graph_data.node_labels is not None:
            graph_data.node_labels.to_parquet(
                output_path / f"{prefix}_labels.parquet", index=False
            )

        log.info(f"Exported graph data to {output_dir}")

    @classmethod
    def load_from_files(cls, input_dir: str, prefix: str = "graph") -> GraphData:
        """Load graph data from parquet files."""
        from pathlib import Path

        input_path = Path(input_dir)

        nodes_df = pd.read_parquet(input_path / f"{prefix}_nodes.parquet")
        edges_df = pd.read_parquet(input_path / f"{prefix}_edges.parquet")

        labels_path = input_path / f"{prefix}_labels.parquet"
        labels_df = pd.read_parquet(labels_path) if labels_path.exists() else None

        return GraphData(nodes=nodes_df, edges=edges_df, node_labels=labels_df)
