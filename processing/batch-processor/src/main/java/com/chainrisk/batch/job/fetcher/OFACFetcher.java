package com.chainrisk.batch.job.fetcher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches sanctioned addresses from OFAC SDN (Specially Designated Nationals) list.
 * 
 * Source: https://sanctionslist.ofac.treas.gov/Home/SdnList
 * Format: XML
 * 
 * OFAC lists include digital currency addresses in the "ID" fields with
 * type "Digital Currency Address".
 */
public class OFACFetcher implements LabelFetcher {
    private static final Logger LOG = LoggerFactory.getLogger(OFACFetcher.class);
    
    private static final String SDN_XML_URL = 
            "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML";
    
    // Pattern to match Ethereum addresses (0x followed by 40 hex chars)
    private static final Pattern ETH_ADDRESS_PATTERN = 
            Pattern.compile("0x[a-fA-F0-9]{40}");
    
    @Override
    public String getSourceName() {
        return "ofac";
    }
    
    @Override
    public List<LabelRecord> fetch() throws Exception {
        LOG.info("Fetching OFAC SDN list from: {}", SDN_XML_URL);
        
        List<LabelRecord> records = new ArrayList<>();
        
        try {
            URL url = new URL(SDN_XML_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            
            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                LOG.warn("OFAC API returned status: {}", responseCode);
                return records;
            }
            
            try (InputStream is = conn.getInputStream()) {
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                // Disable external entities for security
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                DocumentBuilder builder = factory.newDocumentBuilder();
                Document doc = builder.parse(is);
                
                // Find all sdnEntry elements
                NodeList entries = doc.getElementsByTagName("sdnEntry");
                LOG.info("Found {} SDN entries", entries.getLength());
                
                for (int i = 0; i < entries.getLength(); i++) {
                    Element entry = (Element) entries.item(i);
                    List<String> addresses = extractCryptoAddresses(entry);
                    String entityName = getElementText(entry, "lastName");
                    
                    for (String address : addresses) {
                        records.add(new LabelRecord(
                                address,
                                "sanctioned",
                                "OFAC SDN - " + (entityName != null ? entityName : "Unknown"),
                                "ofac",
                                1.0
                        ));
                    }
                }
            }
            
            LOG.info("Extracted {} Ethereum addresses from OFAC SDN list", records.size());
            
        } catch (Exception e) {
            LOG.error("Failed to fetch OFAC SDN list", e);
            throw e;
        }
        
        return records;
    }
    
    private List<String> extractCryptoAddresses(Element entry) {
        List<String> addresses = new ArrayList<>();
        
        // Look for ID elements with digital currency addresses
        NodeList idList = entry.getElementsByTagName("id");
        for (int i = 0; i < idList.getLength(); i++) {
            Element id = (Element) idList.item(i);
            String idType = getElementText(id, "idType");
            String idNumber = getElementText(id, "idNumber");
            
            if (idType != null && idNumber != null) {
                // Check if it's a digital currency address
                if (idType.toLowerCase().contains("digital currency") ||
                    idType.toLowerCase().contains("cryptocurrency")) {
                    
                    // Extract Ethereum addresses
                    Matcher matcher = ETH_ADDRESS_PATTERN.matcher(idNumber);
                    while (matcher.find()) {
                        addresses.add(matcher.group().toLowerCase());
                    }
                }
            }
        }
        
        // Also check remarks for addresses (sometimes listed there)
        NodeList remarks = entry.getElementsByTagName("remarks");
        for (int i = 0; i < remarks.getLength(); i++) {
            String text = remarks.item(i).getTextContent();
            if (text != null) {
                Matcher matcher = ETH_ADDRESS_PATTERN.matcher(text);
                while (matcher.find()) {
                    String addr = matcher.group().toLowerCase();
                    if (!addresses.contains(addr)) {
                        addresses.add(addr);
                    }
                }
            }
        }
        
        return addresses;
    }
    
    private String getElementText(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() > 0) {
            return nodes.item(0).getTextContent();
        }
        return null;
    }
}
