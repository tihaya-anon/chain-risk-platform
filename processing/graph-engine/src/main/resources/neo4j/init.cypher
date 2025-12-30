// Neo4j Initialization Script for Chain Risk Platform
// Run this script in Neo4j Browser or via cypher-shell

// ============================================
// Constraints (ensure uniqueness)
// ============================================

// Address node constraint
CREATE CONSTRAINT address_unique IF NOT EXISTS
FOR (a:Address) REQUIRE a.address IS UNIQUE;

// Cluster node constraint
CREATE CONSTRAINT cluster_unique IF NOT EXISTS
FOR (c:Cluster) REQUIRE c.clusterId IS UNIQUE;

// ============================================
// Indexes (improve query performance)
// ============================================

// Address indexes
CREATE INDEX address_first_seen IF NOT EXISTS
FOR (a:Address) ON (a.firstSeen);

CREATE INDEX address_last_seen IF NOT EXISTS
FOR (a:Address) ON (a.lastSeen);

CREATE INDEX address_risk_score IF NOT EXISTS
FOR (a:Address) ON (a.riskScore);

// Full-text index for tags (enables text search)
CREATE FULLTEXT INDEX address_tags IF NOT EXISTS
FOR (a:Address) ON EACH [a.tagsString];

// Cluster indexes
CREATE INDEX cluster_size IF NOT EXISTS
FOR (c:Cluster) ON (c.size);

CREATE INDEX cluster_risk_score IF NOT EXISTS
FOR (c:Cluster) ON (c.riskScore);

// Transfer relationship index
CREATE INDEX transfer_timestamp IF NOT EXISTS
FOR ()-[t:TRANSFER]-() ON (t.timestamp);

CREATE INDEX transfer_value IF NOT EXISTS
FOR ()-[t:TRANSFER]-() ON (t.value);

// ============================================
// Sample data for testing (optional)
// ============================================

// Uncomment below to create sample data
/*
// Create sample addresses
CREATE (a1:Address {address: '0x1234567890abcdef1234567890abcdef12345678', firstSeen: datetime(), lastSeen: datetime(), txCount: 0, tags: [], riskScore: 0.0})
CREATE (a2:Address {address: '0xabcdef1234567890abcdef1234567890abcdef12', firstSeen: datetime(), lastSeen: datetime(), txCount: 0, tags: [], riskScore: 0.0})
CREATE (a1)-[:TRANSFER {txHash: '0xtest123', value: '1000000000000000000', timestamp: datetime(), tokenSymbol: 'ETH'}]->(a2);
*/
