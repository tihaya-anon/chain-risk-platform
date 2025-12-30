package com.chainrisk.graph.service.impl;

import com.chainrisk.graph.config.GraphProperties;
import com.chainrisk.graph.model.dto.PropagationResultResponse;
import com.chainrisk.graph.model.node.AddressNode;
import com.chainrisk.graph.repository.AddressRepository;
import com.chainrisk.graph.repository.GraphRepositoryImpl;
import com.chainrisk.graph.service.TagPropagationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Result;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Implementation of TagPropagationService using BFS-based propagation.
 * 
 * Risk scores and tags are propagated through the transaction graph with
 * a decay factor that reduces the propagated score at each hop.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BfsTagPropagationService implements TagPropagationService {

    private final AddressRepository addressRepository;
    private final GraphRepositoryImpl graphRepository;
    private final GraphProperties graphProperties;
    private final Driver neo4jDriver;

    private static final double HIGH_RISK_THRESHOLD = 0.6;

    @Override
    @Transactional
    public PropagationResultResponse propagateAllTags() {
        Instant startTime = Instant.now();
        log.info("Starting tag propagation from all high-risk addresses");

        try {
            // Find all high-risk addresses
            List<AddressNode> highRiskAddresses = addressRepository.findHighRiskAddresses(
                    HIGH_RISK_THRESHOLD, 1000);

            if (highRiskAddresses.isEmpty()) {
                log.info("No high-risk addresses found for propagation");
                return PropagationResultResponse.builder()
                        .status("completed")
                        .addressesAffected(0)
                        .tagsPropagated(0)
                        .maxHops(graphProperties.getPropagation().getMaxHops())
                        .decayFactor(graphProperties.getPropagation().getDecayFactor())
                        .durationMs(0L)
                        .startedAt(startTime)
                        .completedAt(Instant.now())
                        .build();
            }

            int totalAffected = 0;
            int totalTags = 0;

            for (AddressNode source : highRiskAddresses) {
                PropagationResultResponse result = propagateFromAddress(source.getAddress());
                if ("completed".equals(result.getStatus())) {
                    totalAffected += result.getAddressesAffected();
                    totalTags += result.getTagsPropagated();
                }
            }

            Instant endTime = Instant.now();
            long durationMs = endTime.toEpochMilli() - startTime.toEpochMilli();

            log.info("Tag propagation completed. Affected {} addresses, propagated {} tags in {}ms",
                    totalAffected, totalTags, durationMs);

            return PropagationResultResponse.builder()
                    .status("completed")
                    .addressesAffected(totalAffected)
                    .tagsPropagated(totalTags)
                    .maxHops(graphProperties.getPropagation().getMaxHops())
                    .decayFactor(graphProperties.getPropagation().getDecayFactor())
                    .durationMs(durationMs)
                    .startedAt(startTime)
                    .completedAt(endTime)
                    .build();

        } catch (Exception e) {
            log.error("Tag propagation failed", e);
            return PropagationResultResponse.builder()
                    .status("failed")
                    .errorMessage(e.getMessage())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();
        }
    }

    @Override
    @Transactional
    public PropagationResultResponse propagateFromAddress(String sourceAddress) {
        Instant startTime = Instant.now();
        log.debug("Propagating from address: {}", sourceAddress);

        try {
            var sourceOpt = addressRepository.findByAddressIgnoreCase(sourceAddress);
            if (sourceOpt.isEmpty()) {
                return PropagationResultResponse.builder()
                        .status("failed")
                        .errorMessage("Source address not found")
                        .startedAt(startTime)
                        .completedAt(Instant.now())
                        .build();
            }

            AddressNode source = sourceOpt.get();
            if (source.getRiskScore() == null || source.getRiskScore() <= 0) {
                return PropagationResultResponse.builder()
                        .status("completed")
                        .addressesAffected(0)
                        .tagsPropagated(0)
                        .startedAt(startTime)
                        .completedAt(Instant.now())
                        .build();
            }

            int maxHops = graphProperties.getPropagation().getMaxHops();
            double decayFactor = graphProperties.getPropagation().getDecayFactor();
            double minThreshold = graphProperties.getPropagation().getMinThreshold();

            // BFS propagation using Cypher
            int affected = bfsPropagation(sourceAddress, source.getRiskScore(), 
                    source.getTags(), maxHops, decayFactor, minThreshold);

            int tagsPropagated = source.getTags() != null ? source.getTags().size() * affected : 0;

            Instant endTime = Instant.now();
            return PropagationResultResponse.builder()
                    .status("completed")
                    .addressesAffected(affected)
                    .tagsPropagated(tagsPropagated)
                    .maxHops(maxHops)
                    .decayFactor(decayFactor)
                    .durationMs(endTime.toEpochMilli() - startTime.toEpochMilli())
                    .startedAt(startTime)
                    .completedAt(endTime)
                    .build();

        } catch (Exception e) {
            log.error("Propagation from {} failed", sourceAddress, e);
            return PropagationResultResponse.builder()
                    .status("failed")
                    .errorMessage(e.getMessage())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();
        }
    }

    @Override
    @Transactional
    public PropagationResultResponse propagateTag(String sourceAddress, String tag) {
        Instant startTime = Instant.now();

        try {
            // First add the tag to source if not present
            addressRepository.addTag(sourceAddress.toLowerCase(), tag);

            // Then propagate
            return propagateFromAddress(sourceAddress);

        } catch (Exception e) {
            log.error("Tag propagation failed", e);
            return PropagationResultResponse.builder()
                    .status("failed")
                    .errorMessage(e.getMessage())
                    .startedAt(startTime)
                    .completedAt(Instant.now())
                    .build();
        }
    }

    @Override
    @Transactional
    public boolean addTags(String address, List<String> tags) {
        try {
            String normalizedAddress = address.toLowerCase();
            
            // Ensure address exists
            var addressOpt = addressRepository.findByAddressIgnoreCase(normalizedAddress);
            if (addressOpt.isEmpty()) {
                // Create address node if it doesn't exist
                AddressNode newAddress = AddressNode.builder()
                        .address(normalizedAddress)
                        .firstSeen(Instant.now())
                        .lastSeen(Instant.now())
                        .txCount(0L)
                        .riskScore(0.0)
                        .tags(new ArrayList<>(tags))
                        .network(graphProperties.getSync().getNetwork())
                        .build();
                addressRepository.save(newAddress);
            } else {
                // Add tags to existing address
                for (String tag : tags) {
                    addressRepository.addTag(normalizedAddress, tag);
                }
            }

            log.info("Added tags {} to address {}", tags, normalizedAddress);
            return true;

        } catch (Exception e) {
            log.error("Failed to add tags to address {}", address, e);
            return false;
        }
    }

    @Override
    @Transactional
    public boolean removeTag(String address, String tag) {
        try {
            addressRepository.removeTag(address.toLowerCase(), tag);
            log.info("Removed tag {} from address {}", tag, address);
            return true;
        } catch (Exception e) {
            log.error("Failed to remove tag from address {}", address, e);
            return false;
        }
    }

    @Override
    public List<String> getTags(String address) {
        return addressRepository.findByAddressIgnoreCase(address)
                .map(AddressNode::getTags)
                .orElse(Collections.emptyList());
    }

    /**
     * BFS propagation using Cypher query
     */
    private int bfsPropagation(String sourceAddress, double sourceRiskScore,
                               List<String> sourceTags, int maxHops,
                               double decayFactor, double minThreshold) {
        
        String cypher = """
            MATCH (source:Address {address: $sourceAddress})
            CALL {
                WITH source
                MATCH path = (source)-[:TRANSFER*1..%d]-(target:Address)
                WHERE target.address <> source.address
                WITH target, min(length(path)) as distance
                WITH target, distance, $sourceRiskScore * power($decayFactor, distance) as propagatedScore
                WHERE propagatedScore >= $minThreshold
                SET target.riskScore = CASE 
                    WHEN target.riskScore IS NULL THEN propagatedScore
                    WHEN target.riskScore < propagatedScore THEN propagatedScore
                    ELSE target.riskScore
                END
                RETURN target
            }
            RETURN count(target) as affected
            """.formatted(maxHops);

        try (Session session = neo4jDriver.session()) {
            Result result = session.run(cypher, Map.of(
                    "sourceAddress", sourceAddress.toLowerCase(),
                    "sourceRiskScore", sourceRiskScore,
                    "decayFactor", decayFactor,
                    "minThreshold", minThreshold
            ));

            if (result.hasNext()) {
                return result.next().get("affected").asInt();
            }
        } catch (Exception e) {
            log.error("BFS propagation query failed", e);
        }
        return 0;
    }
}
