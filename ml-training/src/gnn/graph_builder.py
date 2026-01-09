"""Graph data builder for loading graph from Neo4j and features from Trino/Hudi."""

import logging
from dataclasses import dataclass, field
from typing import Optional

import networkx as nx
import numpy as np
import pandas as pd
from neo4j import GraphDatabase

log = logging.getLogger(__name__)


# Feature columns to load from Trino (excluding metadata columns)
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

# High-risk labels for binary classification
HIGH_RISK_LABELS = {
    "OFAC SDN - Sanctioned Wallet",
    "OFAC SDN - Test Entity 1",
    "OFAC SDN - Test Entity 2",
    "OFAC SDN - Blocked Entity",
    "Tornado Cash Deposit",
    "Tornado Cash Contract",
    "Mixer Service",
    "Privacy Protocol",
}


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
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Load graph structure from Neo4j.

        Returns:
            nodes_df: DataFrame with address column
            edges_df: DataFrame with source, target, weight columns
        """
        driver = self._get_neo4j_driver()

        # Query nodes
        node_query = f"""
        MATCH (a:Address {{network: $network}})
        RETURN a.address AS address, a.network AS network
        {"LIMIT " + str(limit) if limit else ""}
        """

        # Query edges (TRANSFER relationship)
        edge_query = f"""
        MATCH (from:Address {{network: $network}})-[t:TRANSFER]->(to:Address {{network: $network}})
        RETURN from.address AS source, to.address AS target, 
               toFloat(t.amount) AS weight
        {"LIMIT " + str(limit * 10) if limit else ""}
        """

        with driver.session() as session:
            log.info("Loading nodes from Neo4j...")
            nodes_result = session.run(node_query, network=network)
            nodes_data = [dict(record) for record in nodes_result]
            nodes_df = pd.DataFrame(nodes_data) if nodes_data else pd.DataFrame(columns=["address", "network"])
            log.info(f"Loaded {len(nodes_df)} nodes")

            log.info("Loading edges from Neo4j...")
            edges_result = session.run(edge_query, network=network)
            edges_data = [dict(record) for record in edges_result]
            edges_df = pd.DataFrame(edges_data) if edges_data else pd.DataFrame(columns=["source", "target", "weight"])
            log.info(f"Loaded {len(edges_df)} edges")

        return nodes_df, edges_df

    def load_features_from_trino(
        self,
        addresses: list[str],
        network: str = "ethereum",
        feature_columns: Optional[list[str]] = None,
    ) -> pd.DataFrame:
        """
        Load address features from Trino/Hudi.

        Args:
            addresses: List of addresses to load features for
            network: Network name
            feature_columns: Feature columns to load (default: FEATURE_COLUMNS)

        Returns:
            DataFrame with address and feature columns
        """
        if not addresses:
            return pd.DataFrame()

        feature_columns = feature_columns or FEATURE_COLUMNS
        columns = ["address"] + feature_columns

        conn = self._get_trino_connection()
        cursor = conn.cursor()

        # Build query with address filter
        addr_list = ",".join([f"'{addr}'" for addr in addresses])
        query = f"""
        SELECT {", ".join(columns)}
        FROM address_features
        WHERE network = '{network}'
        AND address IN ({addr_list})
        """

        log.info(f"Loading features for {len(addresses)} addresses from Trino...")
        cursor.execute(query)
        rows = cursor.fetchall()

        df = pd.DataFrame(rows, columns=columns)
        log.info(f"Loaded features for {len(df)} addresses")

        return df

    def load_labels_from_trino(
        self,
        addresses: Optional[list[str]] = None,
        high_risk_labels: Optional[set[str]] = None,
    ) -> pd.DataFrame:
        """
        Load address labels from Trino/Hudi and convert to binary labels.

        Args:
            addresses: Optional list of addresses to filter
            high_risk_labels: Set of label names considered high-risk

        Returns:
            DataFrame with address and binary label (0=low risk, 1=high risk)
        """
        high_risk_labels = high_risk_labels or HIGH_RISK_LABELS

        conn = self._get_trino_connection()
        cursor = conn.cursor()

        query = "SELECT address, label FROM address_labels"
        if addresses:
            addr_list = ",".join([f"'{addr}'" for addr in addresses])
            query += f" WHERE address IN ({addr_list})"

        log.info("Loading labels from Trino...")
        cursor.execute(query)
        rows = cursor.fetchall()

        df = pd.DataFrame(rows, columns=["address", "label_name"])

        # Convert to binary: 1 = high risk, 0 = low risk
        df["label"] = df["label_name"].apply(lambda x: 1 if x in high_risk_labels else 0)
        log.info(f"Loaded {len(df)} labels: {df['label'].sum()} high-risk, {(df['label'] == 0).sum()} low-risk")

        # Aggregate by address (take max label if address has multiple labels)
        label_df = df.groupby("address")["label"].max().reset_index()

        return label_df

    def build_graph_data(
        self,
        network: str = "ethereum",
        limit: Optional[int] = None,
        feature_columns: Optional[list[str]] = None,
    ) -> GraphData:
        """
        Build complete graph data with features and labels.

        Args:
            network: Network name
            limit: Optional limit on nodes/edges
            feature_columns: Feature columns to load

        Returns:
            GraphData object ready for PyG conversion
        """
        # Load graph structure
        nodes_df, edges_df = self.load_graph_from_neo4j(network=network, limit=limit)

        if nodes_df.empty:
            log.warning("No nodes found in Neo4j")
            return GraphData(nodes=nodes_df, edges=edges_df)

        addresses = nodes_df["address"].tolist()

        # Load features
        features_df = self.load_features_from_trino(
            addresses=addresses,
            network=network,
            feature_columns=feature_columns,
        )

        # Merge features into nodes
        if not features_df.empty:
            nodes_df = nodes_df.merge(features_df, on="address", how="left")
            # Fill missing features with 0
            feature_cols = feature_columns or FEATURE_COLUMNS
            for col in feature_cols:
                if col in nodes_df.columns:
                    nodes_df[col] = nodes_df[col].fillna(0)

        # Load labels
        labels_df = self.load_labels_from_trino(addresses=addresses)

        # Filter edges to only include nodes in our node set
        valid_nodes = set(nodes_df["address"])
        edges_df = edges_df[
            edges_df["source"].isin(valid_nodes) & edges_df["target"].isin(valid_nodes)
        ]

        log.info(
            f"Built graph: {len(nodes_df)} nodes, {len(edges_df)} edges, "
            f"{len(labels_df)} labeled nodes"
        )

        return GraphData(
            nodes=nodes_df,
            edges=edges_df,
            node_labels=labels_df if not labels_df.empty else None,
        )

    def load_subgraph_for_address(
        self,
        address: str,
        network: str = "ethereum",
        hops: int = 2,
        max_neighbors: int = 50,
    ) -> GraphData:
        """
        Load a subgraph centered on a specific address (for inference).

        Args:
            address: Center address
            network: Network name
            hops: Number of hops to expand
            max_neighbors: Max neighbors per hop

        Returns:
            GraphData for the subgraph
        """
        driver = self._get_neo4j_driver()

        # Multi-hop query to get neighborhood
        query = f"""
        MATCH path = (center:Address {{address: $address, network: $network}})-[:TRANSFER*1..{hops}]-(neighbor:Address)
        WITH center, neighbor, length(path) as dist
        ORDER BY dist
        WITH center, collect(DISTINCT neighbor)[0..{max_neighbors * hops}] as neighbors
        UNWIND [center] + neighbors as node
        WITH collect(DISTINCT node) as all_nodes
        UNWIND all_nodes as n
        RETURN n.address as address
        """

        with driver.session() as session:
            result = session.run(query, address=address, network=network)
            addresses = [record["address"] for record in result]

        if not addresses:
            # If no subgraph found, return just the center node
            addresses = [address]

        # Load edges between these nodes
        edge_query = """
        MATCH (from:Address)-[t:TRANSFER]->(to:Address)
        WHERE from.address IN $addresses AND to.address IN $addresses
        RETURN from.address AS source, to.address AS target, toFloat(t.amount) AS weight
        """

        with driver.session() as session:
            result = session.run(edge_query, addresses=addresses)
            edges_data = [dict(record) for record in result]

        nodes_df = pd.DataFrame({"address": addresses, "network": network})
        edges_df = pd.DataFrame(edges_data) if edges_data else pd.DataFrame(columns=["source", "target", "weight"])

        # Load features
        features_df = self.load_features_from_trino(addresses=addresses, network=network)
        if not features_df.empty:
            nodes_df = nodes_df.merge(features_df, on="address", how="left")
            for col in FEATURE_COLUMNS:
                if col in nodes_df.columns:
                    nodes_df[col] = nodes_df[col].fillna(0)

        return GraphData(nodes=nodes_df, edges=edges_df)
