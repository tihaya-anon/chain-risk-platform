package com.chainrisk.graph.service.impl;

import com.chainrisk.graph.model.dto.*;
import com.chainrisk.graph.model.dto.AddressNeighborsResponse.GraphNode;
import com.chainrisk.graph.model.dto.AddressNeighborsResponse.GraphEdge;
import com.chainrisk.graph.model.node.AddressNode;
import com.chainrisk.graph.model.node.ClusterNode;
import com.chainrisk.graph.repository.AddressRepository;
import com.chainrisk.graph.repository.ClusterRepository;
import com.chainrisk.graph.service.GraphQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Result;
import org.neo4j.driver.Record;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of GraphQueryService
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GraphQueryServiceImpl implements GraphQueryService {

    private final AddressRepository addressRepository;
    private final ClusterRepository clusterRepository;
    private final Driver neo4jDriver;

    @Override
    public Optional<AddressInfoResponse> getAddressInfo(String address) {
        return addressRepository.findByAddressIgnoreCase(address)
                .map(this::toAddressInfoResponse);
    }

    @Override
    public AddressNeighborsResponse getNeighbors(String address, int depth, int limit) {
        String normalizedAddress = address.toLowerCase();

        // Maps to collect nodes and edges
        Map<String, GraphNode> nodeMap = new LinkedHashMap<>();
        Map<String, GraphEdge> edgeMap = new LinkedHashMap<>();

        // BFS query: find all nodes and edges within depth hops (both directions)
        String cypher = """
            MATCH path = (center:Address {address: $address})-[:TRANSFER*1..%d]-(neighbor:Address)
            WITH center, neighbor, 
                 min(length(path)) as distance,
                 relationships(path) as rels
            WHERE neighbor.address <> $address
            RETURN DISTINCT
                   neighbor.address as address,
                   neighbor.riskScore as riskScore,
                   neighbor.tags as tags,
                   neighbor.firstSeen as firstSeen,
                   neighbor.lastSeen as lastSeen,
                   distance
            ORDER BY distance, riskScore DESC
            LIMIT $limit
            """.formatted(depth);

        try (Session session = neo4jDriver.session()) {
            // First, add center node
            Result centerResult = session.run(
                "MATCH (a:Address {address: $address}) " +
                "RETURN a.address as address, a.riskScore as riskScore, a.tags as tags, " +
                "a.firstSeen as firstSeen, a.lastSeen as lastSeen",
                Map.of("address", normalizedAddress)
            );
            
            if (centerResult.hasNext()) {
                Record r = centerResult.next();
                nodeMap.put(normalizedAddress, buildGraphNode(r, 0));
            } else {
                // Center node not found, create placeholder
                nodeMap.put(normalizedAddress, GraphNode.builder()
                        .address(normalizedAddress)
                        .distance(0)
                        .build());
            }

            // Query neighbor nodes
            Result nodeResult = session.run(cypher, Map.of(
                    "address", normalizedAddress,
                    "limit", limit
            ));

            while (nodeResult.hasNext()) {
                Record r = nodeResult.next();
                String addr = r.get("address").asString();
                int distance = r.get("distance").asInt();
                nodeMap.put(addr, buildGraphNode(r, distance));
            }
        } catch (Exception e) {
            log.error("Failed to query neighbor nodes for {}", normalizedAddress, e);
        }

        // Query edges between collected nodes
        if (nodeMap.size() > 1) {
            List<String> addresses = new ArrayList<>(nodeMap.keySet());
            
            String edgeCypher = """
                MATCH (a:Address)-[t:TRANSFER]->(b:Address)
                WHERE a.address IN $addresses AND b.address IN $addresses
                WITH a.address as fromAddr, b.address as toAddr,
                     count(t) as transferCount,
                     sum(toFloat(coalesce(t.value, '0'))) as totalValue,
                     max(t.timestamp) as lastTransfer
                RETURN fromAddr, toAddr, transferCount, totalValue, lastTransfer
                """;

            try (Session session = neo4jDriver.session()) {
                Result edgeResult = session.run(edgeCypher, Map.of("addresses", addresses));

                while (edgeResult.hasNext()) {
                    Record r = edgeResult.next();
                    String from = r.get("fromAddr").asString();
                    String to = r.get("toAddr").asString();
                    String edgeKey = from + "->" + to;

                    edgeMap.put(edgeKey, GraphEdge.builder()
                            .from(from)
                            .to(to)
                            .transferCount(r.get("transferCount").asInt())
                            .totalValue(formatValue(r.get("totalValue")))
                            .lastTransfer(parseTimestamp(r.get("lastTransfer")))
                            .build());
                }
            } catch (Exception e) {
                log.error("Failed to query edges for {}", normalizedAddress, e);
            }
        }

        return AddressNeighborsResponse.builder()
                .address(normalizedAddress)
                .depth(depth)
                .nodes(new ArrayList<>(nodeMap.values()))
                .edges(new ArrayList<>(edgeMap.values()))
                .build();
    }

    private GraphNode buildGraphNode(Record record, int distance) {
        return GraphNode.builder()
                .address(record.get("address").asString())
                .distance(distance)
                .riskScore(record.get("riskScore").isNull() ? null : record.get("riskScore").asDouble())
                .tags(record.get("tags").isNull() ? 
                        Collections.emptyList() : 
                        record.get("tags").asList(v -> v.asString()))
                .firstSeen(parseTimestamp(record.get("firstSeen")))
                .lastSeen(parseTimestamp(record.get("lastSeen")))
                .build();
    }

    private String formatValue(org.neo4j.driver.Value value) {
        if (value.isNull()) return "0";
        Double d = value.asDouble();
        return String.valueOf(d.longValue());
    }

    private Instant parseTimestamp(org.neo4j.driver.Value value) {
        if (value.isNull()) return null;
        return Instant.ofEpochMilli(value.asLong());
    }

    @Override
    public Optional<ClusterResponse> getClusterForAddress(String address) {
        return clusterRepository.findClusterByAddress(address.toLowerCase())
                .map(this::toClusterResponse);
    }

    @Override
    public Optional<ClusterResponse> getClusterById(String clusterId) {
        return clusterRepository.findByClusterId(clusterId)
                .map(this::toClusterResponse);
    }

    @Override
    public PathResponse findPath(String fromAddress, String toAddress, int maxDepth) {
        String normalizedFrom = fromAddress.toLowerCase();
        String normalizedTo = toAddress.toLowerCase();

        if (normalizedFrom.equals(normalizedTo)) {
            log.warn("Path finding requested with same start and end address: {}", normalizedFrom);
            return PathResponse.builder()
                    .found(true)
                    .fromAddress(normalizedFrom)
                    .toAddress(normalizedTo)
                    .pathLength(0)
                    .maxDepth(maxDepth)
                    .path(Collections.emptyList())
                    .message("Start and end addresses are the same")
                    .build();
        }

        String cypher = """
            MATCH path = shortestPath(
                (a:Address {address: $fromAddress})-[t:TRANSFER*1..%d]->(b:Address {address: $toAddress})
            )
            RETURN path, length(path) as pathLength
            """.formatted(maxDepth);

        try (Session session = neo4jDriver.session()) {
            Result result = session.run(cypher, Map.of(
                    "fromAddress", normalizedFrom,
                    "toAddress", normalizedTo
            ));

            if (result.hasNext()) {
                Record record = result.next();
                var path = record.get("path").asPath();
                int pathLength = record.get("pathLength").asInt();

                List<PathResponse.PathNode> pathNodes = new ArrayList<>();
                
                var nodes = path.nodes();
                var relationships = path.relationships();
                
                Iterator<org.neo4j.driver.types.Node> nodeIter = nodes.iterator();
                Iterator<org.neo4j.driver.types.Relationship> relIter = relationships.iterator();

                while (nodeIter.hasNext()) {
                    var node = nodeIter.next();
                    String nodeAddress = node.get("address").asString();
                    Double riskScore = node.get("riskScore").isNull() ? null : node.get("riskScore").asDouble();
                    List<String> tags = node.get("tags").isNull() ? 
                            Collections.emptyList() : 
                            node.get("tags").asList(v -> v.asString());

                    PathResponse.PathNode.PathNodeBuilder builder = PathResponse.PathNode.builder()
                            .address(nodeAddress)
                            .riskScore(riskScore)
                            .tags(tags);

                    if (relIter.hasNext()) {
                        var rel = relIter.next();
                        builder.txHash(rel.get("txHash").asString());
                        builder.value(rel.get("value").asString());
                        if (!rel.get("timestamp").isNull()) {
                            builder.timestamp(Instant.ofEpochMilli(rel.get("timestamp").asLong()));
                        }
                    }

                    pathNodes.add(builder.build());
                }

                return PathResponse.builder()
                        .found(true)
                        .fromAddress(normalizedFrom)
                        .toAddress(normalizedTo)
                        .pathLength(pathLength)
                        .maxDepth(maxDepth)
                        .path(pathNodes)
                        .build();
            }
        } catch (Exception e) {
            log.error("Path finding failed", e);
        }

        return PathResponse.builder()
                .found(false)
                .fromAddress(normalizedFrom)
                .toAddress(normalizedTo)
                .pathLength(0)
                .maxDepth(maxDepth)
                .path(Collections.emptyList())
                .build();
    }

    @Override
    public List<AddressInfoResponse> searchByTag(String tag, int limit) {
        return addressRepository.findByTag(tag).stream()
                .limit(limit)
                .map(this::toAddressInfoResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<AddressInfoResponse> getHighRiskAddresses(double threshold, int limit) {
        return addressRepository.findHighRiskAddresses(threshold, limit).stream()
                .map(this::toAddressInfoResponse)
                .collect(Collectors.toList());
    }

    private AddressInfoResponse toAddressInfoResponse(AddressNode node) {
        Integer incomingCount = addressRepository.countIncomingTransfers(node.getAddress());
        Integer outgoingCount = addressRepository.countOutgoingTransfers(node.getAddress());

        return AddressInfoResponse.builder()
                .address(node.getAddress())
                .firstSeen(node.getFirstSeen())
                .lastSeen(node.getLastSeen())
                .txCount(node.getTxCount())
                .riskScore(node.getRiskScore())
                .tags(node.getTags())
                .clusterId(node.getClusterId())
                .network(node.getNetwork())
                .incomingCount(incomingCount)
                .outgoingCount(outgoingCount)
                .build();
    }

    private ClusterResponse toClusterResponse(ClusterNode cluster) {
        List<String> addresses = clusterRepository.findAddressesInCluster(cluster.getClusterId());

        return ClusterResponse.builder()
                .clusterId(cluster.getClusterId())
                .size(cluster.getSize())
                .riskScore(cluster.getRiskScore())
                .label(cluster.getLabel())
                .category(cluster.getCategory())
                .tags(cluster.getTags())
                .addresses(addresses)
                .createdAt(cluster.getCreatedAt())
                .updatedAt(cluster.getUpdatedAt())
                .network(cluster.getNetwork())
                .build();
    }
}
