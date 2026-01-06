package com.chainrisk.batch.job.fetcher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Mock Label Fetcher for testing purposes.
 * 
 * Generates synthetic labels for test addresses to enable ML training validation.
 * Uses deterministic random generation based on address hash for reproducibility.
 * 
 * Label distribution:
 * - ~20% sanctioned (high risk)
 * - ~15% mixer (high risk)
 * - ~30% exchange (low risk - legitimate)
 * - ~35% unlabeled (no label generated)
 */
public class MockLabelFetcher implements LabelFetcher {
    private static final Logger LOG = LoggerFactory.getLogger(MockLabelFetcher.class);
    
    private final List<String> testAddresses;
    
    private static final String[] SANCTIONED_LABELS = {
        "OFAC SDN - Test Entity 1",
        "OFAC SDN - Test Entity 2", 
        "OFAC SDN - Sanctioned Wallet",
        "OFAC SDN - Blocked Entity"
    };
    
    private static final String[] MIXER_LABELS = {
        "Tornado Cash Contract",
        "Tornado Cash Deposit",
        "Mixer Service",
        "Privacy Protocol"
    };
    
    private static final String[] EXCHANGE_LABELS = {
        "Binance Hot Wallet",
        "Coinbase Commerce",
        "Kraken Deposit",
        "OKX Exchange",
        "Gemini Wallet"
    };
    
    public MockLabelFetcher() {
        this.testAddresses = new ArrayList<>();
    }
    
    public MockLabelFetcher(List<String> addresses) {
        this.testAddresses = addresses != null ? addresses : new ArrayList<>();
    }
    
    /**
     * Set test addresses to generate labels for
     */
    public void setTestAddresses(List<String> addresses) {
        this.testAddresses.clear();
        if (addresses != null) {
            this.testAddresses.addAll(addresses);
        }
    }
    
    @Override
    public String getSourceName() {
        return "mock";
    }
    
    @Override
    public List<LabelRecord> fetch() throws Exception {
        LOG.info("Generating mock labels for {} test addresses", testAddresses.size());
        
        List<LabelRecord> records = new ArrayList<>();
        
        for (String address : testAddresses) {
            LabelRecord label = generateLabelForAddress(address);
            if (label != null) {
                records.add(label);
            }
        }
        
        LOG.info("Generated {} mock labels (sanctioned: {}, mixer: {}, exchange: {})",
                records.size(),
                records.stream().filter(r -> "sanctioned".equals(r.getLabelType())).count(),
                records.stream().filter(r -> "mixer".equals(r.getLabelType())).count(),
                records.stream().filter(r -> "exchange".equals(r.getLabelType())).count());
        
        return records;
    }
    
    /**
     * Generate a deterministic label for an address based on its hash.
     * Returns null for addresses that should remain unlabeled.
     */
    private LabelRecord generateLabelForAddress(String address) {
        // Use address hash for deterministic randomness
        int hash = address.toLowerCase().hashCode();
        Random rand = new Random(hash);
        
        double roll = rand.nextDouble();
        
        if (roll < 0.20) {
            // 20% sanctioned
            String label = SANCTIONED_LABELS[Math.abs(hash) % SANCTIONED_LABELS.length];
            return new LabelRecord(address, "sanctioned", label, "mock", 0.95);
        } else if (roll < 0.35) {
            // 15% mixer
            String label = MIXER_LABELS[Math.abs(hash) % MIXER_LABELS.length];
            return new LabelRecord(address, "mixer", label, "mock", 0.90);
        } else if (roll < 0.65) {
            // 30% exchange
            String label = EXCHANGE_LABELS[Math.abs(hash) % EXCHANGE_LABELS.length];
            return new LabelRecord(address, "exchange", label, "mock", 0.85);
        }
        
        // 35% unlabeled
        return null;
    }
}
