package com.chainrisk.graph.service;

import com.chainrisk.graph.model.dto.PropagationResultResponse;

import java.util.List;

/**
 * Service interface for tag propagation operations
 */
public interface TagPropagationService {

    /**
     * Propagate tags from all high-risk addresses
     * @return propagation result with statistics
     */
    PropagationResultResponse propagateAllTags();

    /**
     * Propagate tags from a specific source address
     * @param sourceAddress the address to propagate from
     * @return propagation result
     */
    PropagationResultResponse propagateFromAddress(String sourceAddress);

    /**
     * Propagate a specific tag from source address
     * @param sourceAddress the address to propagate from
     * @param tag the tag to propagate
     * @return propagation result
     */
    PropagationResultResponse propagateTag(String sourceAddress, String tag);

    /**
     * Add a tag to an address (manual tagging)
     * @param address the address to tag
     * @param tags the tags to add
     * @return true if successful
     */
    boolean addTags(String address, List<String> tags);

    /**
     * Remove a tag from an address
     * @param address the address
     * @param tag the tag to remove
     * @return true if successful
     */
    boolean removeTag(String address, String tag);

    /**
     * Get tags for an address
     * @param address the address
     * @return list of tags
     */
    List<String> getTags(String address);
}
