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

        // Get outgoing neighbors
        var outgoing = addressRepository.findOutgoingNeighbors(normalizedAddress, limit / 2);
        for (var projection : outgoing) {
            AddressNode neighbor = projection.getB();
            if (neighbor != null) {
                neighbors.add(AddressNeighborsResponse.NeighborInfo.builder()
                        .address(neighbor.getAddress())
                        .direction("outgoing")
                        .transferCount(projection.getTransferCount())
                        .totalValue(projection.getTotalValue() != null ? 
                                String.valueOf(projection.getTotalValue().longValue()) : "0")
                        .lastTransfer(projection.getLastTransfer())
                        .riskScore(neighbor.getRiskScore())
                        .tags(neighbor.getTags())
                        .build());
            }
        }

        // Get incoming neighbors
        var incoming = addressRepository.findIncomingNeighbors(normalizedAddress, limit / 2);
        for (var projection : incoming) {
            AddressNode neighbor = projection.getA();
            if (neighbor != null) {
                neighbors.add(AddressNeighborsResponse.NeighborInfo.builder()
                        .address(neighbor.getAddress())
                        .direction("incoming")
                        .transferCount(projection.getTransferCount())
                        .totalValue(projection.getTotalValue() != null ? 
                                String.valueOf(projection.getTotalValue().longValue()) : "0")
                        .lastTransfer(projection.getLastTransfer())
                        .riskScore(neighbor.getRiskScore())
                        .tags(neighbor.getTags())
                        .build());
            }
        }

        return AddressNeighborsResponse.builder()
                .address(normalizedAddress)
                .neighbors(neighbors)
                .totalCount(neighbors.size())
                .depth(depth)
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
        String cypher = """
            MATCH path = shortestPath(
                (a:Address {address: $fromAddress})-[t:TRANSFER*1..%d]->(b:Address {address: $toAddress})
            )
            RETURN path, length(path) as pathLength
            """.formatted(maxDepth);

        try (Session session = neo4jDriver.session()) {
            Result result = session.run(cypher, Map.of(
                    "fromAddress", fromAddress.toLowerCase(),
                    "toAddress", toAddress.toLowerCase()
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
                            builder.timestamp(rel.get("timestamp").asZonedDateTime().toInstant());
                        }
                    }

                    pathNodes.add(builder.build());
                }

                return PathResponse.builder()
                        .found(true)
                        .fromAddress(fromAddress.toLowerCase())
                        .toAddress(toAddress.toLowerCase())
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
                .fromAddress(fromAddress.toLowerCase())
                .toAddress(toAddress.toLowerCase())
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
