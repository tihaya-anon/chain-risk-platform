// Neo4j Rolling Data Cleanup Script
// Cleans up old nodes and relationships based on TTL
// Run via cron: daily at 00:10

// ============================================
// 1. Add TTL Index (one-time setup)
// ============================================

// Create index on lastSeen for efficient cleanup queries
CREATE INDEX address_lastSeen_idx IF NOT EXISTS FOR (a:Address) ON (a.lastSeen);
CREATE INDEX transfer_timestamp_idx IF NOT EXISTS FOR ()-[r:TRANSFER]-() ON (r.timestamp);
CREATE INDEX cluster_lastUpdated_idx IF NOT EXISTS FOR (c:Cluster) ON (c.lastUpdated);

// ============================================
// 2. Cleanup Old Transfers (Relationships)
// ============================================

// Delete TRANSFER relationships older than retention period
// Default: 30 days
// Parameters: $retentionDays (INTEGER)

:param retentionDays => 30;

// Count transfers to delete (dry run)
MATCH ()-[r:TRANSFER]->()
WHERE r.timestamp < datetime() - duration({days: $retentionDays})
RETURN count(r) AS transfersToDelete;

// Delete transfers in batches to avoid memory issues
CALL apoc.periodic.iterate(
  "MATCH ()-[r:TRANSFER]->()
   WHERE r.timestamp < datetime() - duration({days: $retentionDays})
   RETURN r",
  "DELETE r",
  {batchSize: 10000, parallel: false, params: {retentionDays: $retentionDays}}
) YIELD batches, total, timeTaken
RETURN batches, total, timeTaken AS transferCleanupTime;

// ============================================
// 3. Cleanup Orphan Address Nodes
// ============================================

// Delete Address nodes with no relationships and not seen recently
// Keep addresses that have tags (valuable metadata)

CALL apoc.periodic.iterate(
  "MATCH (a:Address)
   WHERE NOT (a)-[:TRANSFER]-() 
   AND NOT ()-[:TRANSFER]->(a)
   AND a.lastSeen < datetime() - duration({days: $retentionDays})
   AND (a.tags IS NULL OR size(a.tags) = 0)
   RETURN a",
  "DELETE a",
  {batchSize: 5000, parallel: false, params: {retentionDays: $retentionDays}}
) YIELD batches, total, timeTaken
RETURN batches, total, timeTaken AS orphanAddressCleanupTime;

// ============================================
// 4. Cleanup Old Cluster Nodes
// ============================================

// Delete Cluster nodes that haven't been updated recently and have no members

CALL apoc.periodic.iterate(
  "MATCH (c:Cluster)
   WHERE c.lastUpdated < datetime() - duration({days: $retentionDays})
   AND c.memberCount = 0
   RETURN c",
  "DELETE c",
  {batchSize: 1000, parallel: false, params: {retentionDays: $retentionDays}}
) YIELD batches, total, timeTaken
RETURN batches, total, timeTaken AS clusterCleanupTime;

// ============================================
// 5. Update Statistics After Cleanup
// ============================================

// Recalculate address transaction counts after relationship cleanup
CALL apoc.periodic.iterate(
  "MATCH (a:Address)
   WHERE EXISTS(a.txCount)
   RETURN a",
  "WITH a
   OPTIONAL MATCH (a)-[out:TRANSFER]->()
   OPTIONAL MATCH ()-[in:TRANSFER]->(a)
   WITH a, count(DISTINCT out) + count(DISTINCT in) AS actualCount
   SET a.txCount = actualCount",
  {batchSize: 5000, parallel: false}
) YIELD batches, total
RETURN batches, total AS recalculatedAddresses;

// ============================================
// 6. Cleanup Summary Query
// ============================================

// Get cleanup statistics
MATCH (a:Address)
WITH count(a) AS totalAddresses
MATCH ()-[r:TRANSFER]->()
WITH totalAddresses, count(r) AS totalTransfers
MATCH (c:Cluster)
RETURN totalAddresses, totalTransfers, count(c) AS totalClusters;

// ============================================
// 7. Database Statistics
// ============================================

// Get data distribution by time periods
MATCH ()-[r:TRANSFER]->()
WITH r.timestamp AS ts
WHERE ts IS NOT NULL
RETURN 
  CASE 
    WHEN ts >= datetime() - duration({days: 1}) THEN 'last_1_day'
    WHEN ts >= datetime() - duration({days: 7}) THEN 'last_7_days'
    WHEN ts >= datetime() - duration({days: 30}) THEN 'last_30_days'
    ELSE 'older_than_30_days'
  END AS period,
  count(*) AS count
ORDER BY count DESC;

// ============================================
// 8. Full Cleanup Procedure (Combined)
// ============================================

// Single procedure to run all cleanup steps
// Usage: CALL chain_data.rolling_cleanup(30)

// Note: This requires APOC plugin and custom procedure creation
// For production, wrap in a stored procedure or run as scheduled job

/*
Example shell command to run this script:
cypher-shell -u neo4j -p chainrisk123 \
  --param "retentionDays => 30" \
  -f neo4j-cleanup.cypher
*/
