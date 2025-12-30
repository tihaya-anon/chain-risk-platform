package com.chainrisk.graph.algorithm;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Union-Find (Disjoint Set Union) data structure for address clustering.
 * 
 * Uses path compression and union by rank for optimal performance.
 * Time complexity: O(α(n)) per operation, where α is the inverse Ackermann function.
 */
public class UnionFind {

    private final Map<String, String> parent;
    private final Map<String, Integer> rank;

    public UnionFind() {
        this.parent = new HashMap<>();
        this.rank = new HashMap<>();
    }

    /**
     * Find the root/representative of the set containing element x.
     * Uses path compression for optimization.
     */
    public String find(String x) {
        if (!parent.containsKey(x)) {
            parent.put(x, x);
            rank.put(x, 0);
        }

        if (!parent.get(x).equals(x)) {
            // Path compression: make every node point directly to root
            parent.put(x, find(parent.get(x)));
        }
        return parent.get(x);
    }

    /**
     * Union the sets containing elements x and y.
     * Uses union by rank for optimization.
     * 
     * @return true if x and y were in different sets (union performed),
     *         false if they were already in the same set
     */
    public boolean union(String x, String y) {
        String rootX = find(x);
        String rootY = find(y);

        if (rootX.equals(rootY)) {
            return false; // Already in the same set
        }

        // Union by rank: attach smaller tree under root of larger tree
        int rankX = rank.get(rootX);
        int rankY = rank.get(rootY);

        if (rankX < rankY) {
            parent.put(rootX, rootY);
        } else if (rankX > rankY) {
            parent.put(rootY, rootX);
        } else {
            parent.put(rootY, rootX);
            rank.put(rootX, rankX + 1);
        }

        return true;
    }

    /**
     * Check if two elements are in the same set.
     */
    public boolean connected(String x, String y) {
        return find(x).equals(find(y));
    }

    /**
     * Get all unique cluster roots.
     */
    public Set<String> getClusterRoots() {
        Set<String> roots = new HashSet<>();
        for (String element : parent.keySet()) {
            roots.add(find(element));
        }
        return roots;
    }

    /**
     * Get all elements in the same cluster as the given element.
     */
    public Set<String> getClusterMembers(String element) {
        String root = find(element);
        Set<String> members = new HashSet<>();
        
        for (String e : parent.keySet()) {
            if (find(e).equals(root)) {
                members.add(e);
            }
        }
        return members;
    }

    /**
     * Get all clusters as a map from root to members.
     */
    public Map<String, Set<String>> getAllClusters() {
        Map<String, Set<String>> clusters = new HashMap<>();
        
        for (String element : parent.keySet()) {
            String root = find(element);
            clusters.computeIfAbsent(root, k -> new HashSet<>()).add(element);
        }
        
        return clusters;
    }

    /**
     * Get the number of distinct clusters.
     */
    public int getClusterCount() {
        return getClusterRoots().size();
    }

    /**
     * Get the total number of elements.
     */
    public int size() {
        return parent.size();
    }

    /**
     * Get the size of the cluster containing the given element.
     */
    public int getClusterSize(String element) {
        return getClusterMembers(element).size();
    }

    /**
     * Clear all data.
     */
    public void clear() {
        parent.clear();
        rank.clear();
    }
}
