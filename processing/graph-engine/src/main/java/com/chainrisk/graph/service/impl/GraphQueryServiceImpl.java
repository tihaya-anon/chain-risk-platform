package com.chainrisk.graph.service.impl;

import com.chainrisk.graph.model.dto.*;
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
import java.time.ZonedDateTime;
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
        
        List<AddressNeighborsResponse.NeighborInfo> neighbors = new ArrayList<>();

        // Get outgoing neighbors using native Neo4j driver
        String outgoingCypher = """
            MATCH (a:Address {address: $address})-[t:TRANSFER]->(neighbor:Address)
            WITH neighbor, count(t) as transferCount, sum(toFloat(t.value)) as totalValue, max(t.timestamp) as lastTransfer
            RETURN neighbor.address as address, neighbor.riskScore as riskScore, neighbor.tags as tags,
                   transferCount, totalValue, lastTransfer
            ORDER BY transferCount DESC
            LIMIT $limit
            """;

        try (Session session = neo4jDriver.session()) {
            Result outgoingResult = session.run(outgoingCypher, Map.of(
                    "address", normalizedAddress,
                    "limit", limit / 2
            ));

            while (outgoingResult.hasNext()) {
                Record record = outgoingResult.next();
                neighbors.add(buildNeighborInfo(record, "outgoing"));
            }
        }

        // Get incoming neighbors using native Neo4j driver
        String incomingCypher = """
            MATCH (neighbor:Address)-[t:TRANSFER]->(b:Address {address: $address})
            WITH neighbor, count(t) as transferCount, sum(toFloat(t.value)) as totalValue, max(t.timestamp) as lastTransfer
            RETURN neighbor.address as address, neighbor.riskScore as riskScore, neighbor.tags as tags,
                   transferCount, totalValue, lastTransfer
            ORDER BY transferCount DESC
            LIMIT $limit
            """;

        try (Session session = neo4jDriver.session()) {
            Result incomingResult = session.run(incomingCypher, Map.of(
                    "address", normalizedAddress,
                    "limit", limit / 2
            ));

            while (incomingResult.hasNext()) {
                Record record = incomingResult.next();
                neighbors.add(buildNeighborInfo(record, "incoming"));
            }
        }

        return AddressNeighborsResponse.builder()
                .address(normalizedAddress)
                .neighbors(neighbors)
                .totalCount(neighbors.size())
                .depth(depth)
                .build();
    }

    /**
     * Build NeighborInfo from Neo4j Record
     */
    private AddressNeighborsResponse.NeighborInfo buildNeighborInfo(Record record, String direction) {
        String neighborAddress = record.get("address").asString();
        Double riskScore = record.get("riskScore").isNull() ? null : record.get("riskScore").asDouble();
        List<String> tags = record.get("tags").isNull() ? 
                Collections.emptyList() : 
                record.get("tags").asList(v -> v.asString());
        int transferCount = record.get("transferCount").asInt();
        Double totalValue = record.get("totalValue").isNull() ? null : record.get("totalValue").asDouble();
        Instant lastTransfer = null;
        if (!record.get("lastTransfer").isNull()) {
            lastTransfer = Instant.ofEpochMilli(record.get("lastTransfer").asLong());
        }

        return AddressNeighborsResponse.NeighborInfo.builder()
                .address(neighborAddress)
                .direction(direction)
                .transferCount(transferCount)
                .totalValue(totalValue != null ? String.valueOf(totalValue.longValue()) : "0")
                .lastTransfer(lastTransfer)
                .riskScore(riskScore)
                .tags(tags)
                .build();
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

        // Handle case when start and end nodes are the same
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
                
                // Extract nodes and relationships from path
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
                            long timestampMillis = rel.get("timestamp").asLong();
                            builder.timestamp(Instant.ofEpochMilli(timestampMillis));
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
