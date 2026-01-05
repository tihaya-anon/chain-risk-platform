package com.chainrisk.batch.job.fetcher;

import java.io.Serializable;
import java.util.List;

/**
 * Base interface for label data fetchers.
 * Each fetcher retrieves label data from a specific public source.
 */
public interface LabelFetcher extends Serializable {
    
    /**
     * Get the source name (e.g., "ofac", "tornado_cash", "exchange")
     */
    String getSourceName();
    
    /**
     * Fetch labels from the public source.
     * @return List of label records
     */
    List<LabelRecord> fetch() throws Exception;
    
    /**
     * Label record structure
     */
    class LabelRecord implements Serializable {
        private static final long serialVersionUID = 1L;
        
        private String address;
        private String labelType;
        private String label;
        private String source;
        private double confidence;
        
        public LabelRecord() {}
        
        public LabelRecord(String address, String labelType, String label, 
                          String source, double confidence) {
            this.address = address.toLowerCase();
            this.labelType = labelType;
            this.label = label;
            this.source = source;
            this.confidence = confidence;
        }
        
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address.toLowerCase(); }
        
        public String getLabelType() { return labelType; }
        public void setLabelType(String labelType) { this.labelType = labelType; }
        
        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        
        public String getSource() { return source; }
        public void setSource(String source) { this.source = source; }
        
        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
        
        @Override
        public String toString() {
            return String.format("LabelRecord{address='%s', type='%s', label='%s', source='%s'}", 
                    address, labelType, label, source);
        }
    }
}
