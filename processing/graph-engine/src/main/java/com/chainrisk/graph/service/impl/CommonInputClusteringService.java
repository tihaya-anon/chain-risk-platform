package com.chainrisk.graph.service.impl;

import com.chainrisk.graph.algorithm.UnionFind;
import com.chainrisk.graph.config.GraphProperties;
import com.chainrisk.graph.model.dto.ClusteringResultResponse;
import com.chainrisk.graph.model.node.ClusterNode;
import com.chainrisk.graph.repository.AddressRepository;
import com.chainrisk.graph.repository.ClusterRepository;
import com.chainrisk.graph.repository.GraphRepositoryImpl;
import com.chainrisk.graph.repository.GraphRepositoryImpl.CommonInputPair;
import com.chainrisk.graph.service.ClusteringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Implementation of ClusteringService using Common Input Heuristic.
 * 
 * Common Input Heuristic: If two addresses appear as senders in the same block
 * multiple times, they are likely controlled by the same entity.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommonInputClusteringService implements ClusteringService {

    private final AddressRepository addressRepository;
    private final ClusterRepository clusterRepository;
    private final GraphRepositoryImpl graphRepository;
    private final GraphProperties graphProperties;

    private static final int MIN_COMMON_BLOCKS = 2; // Minimum common blocks to consider clustering
    private static final int PAIR_LIMIT = 10000;    // Maximum pairs to process per run

    @Override
    @Transactional
    public ClusteringResultResponse runClustering() {
        Instant startTime = Instant.now();
        log.info("Starting clustering process");

        try {
            // Step 1: Find address pairs that appear together in same blocks
            List<CommonInputPair> pairs = graphRepository.findCommonInputPairs(MIN_COMMON_BLOCKS, PAIR_LIMIT);
            log.info("Found {} common input pairs", pairs.size());

            if (pairs.isEmpty()) {
                return ClusteringResultResponse.builder()
                        .status("completed")
                        .clustersCreated(0)
                        .addressesClustered(0)
                        .durationMs(System.currentTimeMillis() - startTime.toEpochMilli())
                        .startedAt(startTime)
                        .completedAt(Instant.now())
                        .build();
            }

            // Step 2: Use Union-Find to group addresses
            UnionFind uf = new UnionFind();
            for (CommonInputPair pair : pairs) {
                uf.union(pair.address1(), pair.address2());
            }

            // Step 3: Get all clusters
            Map<String, Set<String>> clusters = uf.getAllClusters();
            log.info("Formed {} clusters from {} addresses", clusters.size(), uf.size());

            // Step 4: Filter and persist clusters
            int clustersCreated = 0;
            int addressesClustered = 0;
            int minClusterSize = graphProperties.getClustering().getMinClusterSize();

            for (Map.Entry<String, Set<String>> entry : clusters.entrySet()) {
                Set<String> members = entry.getValue();
                
                if (members.size() < minClusterSize) {
                    continue; // Skip small clusters
                }

                String clusterId = generateClusterId();
                
                // Create cluster node
                ClusterNode clusterNode = ClusterNode.builder()
                        .clusterId(clusterId)
                        .size(members.size())
                        .riskScore(0.0)
                        .tags(new ArrayList<>())
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .network(graphProperties.getSync().getNetwork())
                        .build();

                clusterRepository.save(clusterNode);

                // Update addresses with cluster ID
                for (String address : members) {
                    addressRepository.updateClusterId(address, clusterId);
                    addressesClustered++;
                }

                // Recalculate cluster metrics
                clusterRepository.recalculateRiskScore(clusterId);
                clusterRepository.aggregateTags(clusterId);

                clustersCreated++;
            }

            Instant endTime = Instant.now();
            long durationMs = endTime.toEpochMilli() - startTime.toEpochMilli();

            log.info("Clustering completed. Created {} clusters with {} addresses in {}ms",
                    clustersCreated, addressesClustered, durationMs);

            return ClusteringResultResponse.builder()
                    .status("completed")
                    .clustersCreated(clustersCreated)
                    .addressesClustered(addressesClustered)
                    .durationMs(durationMs)
                    .startedAt(startTime)
                    .completedAt(endTime)
                    .build();

        } catch (Exception e) {
            log.error("Clustering failed", e);
            return ClusteringResultResponse.builder()
                    .status("failed")
                    .errorMessage(e.getMessage())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .durationMs(System.currentTimeMillis() - startTime.toEpochMilli())
                    .build();
        }
    }

    @Override
    @Transactional
    public ClusteringResultResponse clusterAddresses(List<String> addresses) {
        Instant startTime = Instant.now();
        
        if (addresses == null || addresses.size() < 2) {
            return ClusteringResultResponse.builder()
                    .status("failed")
                    .errorMessage("At least 2 addresses required for clustering")
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();
        }

        try {
            String clusterId = generateClusterId();

            // Create cluster node
            ClusterNode clusterNode = ClusterNode.builder()
                    .clusterId(clusterId)
                    .size(addresses.size())
                    .riskScore(0.0)
                    .tags(new ArrayList<>())
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .network(graphProperties.getSync().getNetwork())
                    .build();

            clusterRepository.save(clusterNode);

            // Update addresses with cluster ID
            for (String address : addresses) {
                addressRepository.updateClusterId(address.toLowerCase(), clusterId);
            }

            // Recalculate cluster metrics
            clusterRepository.recalculateRiskScore(clusterId);
            clusterRepository.aggregateTags(clusterId);

            return ClusteringResultResponse.builder()
                    .status("completed")
                    .clustersCreated(1)
                    .addressesClustered(addresses.size())
                    .durationMs(System.currentTimeMillis() - startTime.toEpochMilli())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();

        } catch (Exception e) {
            log.error("Manual clustering failed", e);
            return ClusteringResultResponse.builder()
                    .status("failed")
                    .errorMessage(e.getMessage())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();
        }
    }

    @Override
    public String getClusterForAddress(String address) {
        return addressRepository.findByAddressIgnoreCase(address)
                .map(a -> a.getClusterId())
                .orElse(null);
    }

    @Override
    @Transactional
    public String mergeClusters(String clusterId1, String clusterId2) {
        if (clusterId1.equals(clusterId2)) {
            return clusterId1;
        }

        // Get addresses from both clusters
        List<String> addresses1 = clusterRepository.findAddressesInCluster(clusterId1);
        List<String> addresses2 = clusterRepository.findAddressesInCluster(clusterId2);

        // Move all addresses to cluster1
        for (String address : addresses2) {
            addressRepository.updateClusterId(address, clusterId1);
        }

        // Update cluster1 size
        clusterRepository.recalculateSize(clusterId1);
        clusterRepository.recalculateRiskScore(clusterId1);
        clusterRepository.aggregateTags(clusterId1);

        // Delete cluster2
        clusterRepository.deleteById(clusterId2);

        log.info("Merged cluster {} into {}", clusterId2, clusterId1);
        return clusterId1;
    }

    @Override
    @Transactional
    public boolean removeFromCluster(String address) {
        var addressNode = addressRepository.findByAddressIgnoreCase(address);
        if (addressNode.isEmpty() || addressNode.get().getClusterId() == null) {
            return false;
        }

        String clusterId = addressNode.get().getClusterId();
        
        // Remove cluster ID from address
        addressRepository.updateClusterId(address, null);

        // Update cluster size
        clusterRepository.recalculateSize(clusterId);

        // Delete cluster if empty
        Integer size = clusterRepository.countAddressesInCluster(clusterId);
        if (size == null || size == 0) {
            clusterRepository.deleteById(clusterId);
        }

        return true;
    }

    private String generateClusterId() {
        return "cluster-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
