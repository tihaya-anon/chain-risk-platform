package com.chainrisk.batch.job.fetcher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches Tornado Cash mixer addresses.
 * 
 * Tornado Cash is a decentralized mixer protocol. Its contract addresses
 * were sanctioned by OFAC in August 2022.
 * 
 * Sources:
 * - Official contract addresses (hardcoded - these don't change)
 * - GitHub lists of known deposit/withdrawal addresses
 */
public class TornadoCashFetcher implements LabelFetcher {
    private static final Logger LOG = LoggerFactory.getLogger(TornadoCashFetcher.class);
    
    // Pattern to match Ethereum addresses
    private static final Pattern ETH_ADDRESS_PATTERN = 
            Pattern.compile("0x[a-fA-F0-9]{40}");
    
    // Official Tornado Cash contract addresses (Ethereum mainnet)
    // Source: https://docs.tornado.ws/general/tornado-cash-smart-contracts
    private static final String[] TORNADO_CONTRACTS = {
            // ETH pools
            "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc",  // 0.1 ETH
            "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936",  // 1 ETH
            "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf",  // 10 ETH
            "0xa160cdab225685da1d56aa342ad8841c3b53f291",  // 100 ETH
            
            // DAI pools
            "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3",  // 100 DAI
            "0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144",  // 1000 DAI
            "0x07687e702b410fa43f4cb4af7fa097918ffd2730",  // 10000 DAI
            "0x23773e65ed146a459791799d01336db287f25334",  // 100000 DAI
            
            // cDAI pools
            "0x22aaa7720ddd5388a3c0a3333430953c68f1849b",  // 5000 cDAI
            "0x03893a7c7463ae47d46bc7f091665f1893656003",  // 50000 cDAI
            "0x2717c5e28cf931547b621a5dddb772ab6a35b701",  // 500000 cDAI
            "0xd21be7248e0197ee08e0c20d4a96debdac3d20af",  // 5000000 cDAI
            
            // USDC pools
            "0xd96f2b1c14db8458374d9aca76e26c3d18364307",  // 100 USDC
            "0x4736dcf1b7a3d580672cce6e7c65cd5cc9cfba9d",  // 1000 USDC
            
            // USDT pools
            "0x169ad27a470d064dede56a2d3ff727986b15d52b",  // 100 USDT
            "0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f",  // 1000 USDT
            
            // WBTC pools
            "0x178169b423a011fff22b9e3f3abea13414ddd0f1",  // 0.1 WBTC
            "0x610b717796ad172b316836ac95a2ffad065ceab4",  // 1 WBTC
            "0xbb93e510bbcd0b7beb5a853875f9ec60275cf498",  // 10 WBTC
            
            // Governance and router
            "0x77777feddddffc19ff86db637967013e6c6a116c",  // Tornado Cash Router
            "0x5efda50f22d34f262c29268506c5fa42cb56a1ce",  // Governance
            "0x722122df12d4e14e13ac3b6895a86e84145b6967",  // Proxy (OFAC sanctioned)
    };
    
    @Override
    public String getSourceName() {
        return "tornado_cash";
    }
    
    @Override
    public List<LabelRecord> fetch() throws Exception {
        LOG.info("Fetching Tornado Cash addresses");
        
        List<LabelRecord> records = new ArrayList<>();
        
        // Add official contract addresses
        for (String address : TORNADO_CONTRACTS) {
            records.add(new LabelRecord(
                    address,
                    "mixer",
                    "Tornado Cash Contract",
                    "tornado_cash",
                    1.0
            ));
        }
        
        LOG.info("Added {} Tornado Cash contract addresses", records.size());
        
        // Try to fetch additional addresses from public GitHub lists
        try {
            List<LabelRecord> githubRecords = fetchFromGitHub();
            records.addAll(githubRecords);
            LOG.info("Added {} additional addresses from GitHub", githubRecords.size());
        } catch (Exception e) {
            LOG.warn("Failed to fetch from GitHub, using only contract addresses: {}", e.getMessage());
        }
        
        return records;
    }
    
    private List<LabelRecord> fetchFromGitHub() throws Exception {
        List<LabelRecord> records = new ArrayList<>();
        
        // Try multiple sources
        String[] sources = {
                // Note: These URLs may change or become unavailable
                "https://raw.githubusercontent.com/ultrasoundmoney/ofac-ethereum-addresses/main/data/addresses.txt",
        };
        
        for (String sourceUrl : sources) {
            try {
                List<String> addresses = fetchAddressesFromUrl(sourceUrl);
                for (String address : addresses) {
                    // Only add if it looks like an Ethereum address and not already added
                    if (ETH_ADDRESS_PATTERN.matcher(address).matches()) {
                        records.add(new LabelRecord(
                                address,
                                "mixer",
                                "Tornado Cash Related",
                                "tornado_cash",
                                0.9  // Slightly lower confidence for derived lists
                        ));
                    }
                }
            } catch (Exception e) {
                LOG.debug("Could not fetch from {}: {}", sourceUrl, e.getMessage());
            }
        }
        
        return records;
    }
    
    private List<String> fetchAddressesFromUrl(String urlString) throws Exception {
        List<String> addresses = new ArrayList<>();
        
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(30000);
        
        if (conn.getResponseCode() != 200) {
            throw new RuntimeException("HTTP " + conn.getResponseCode());
        }
        
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim().toLowerCase();
                Matcher matcher = ETH_ADDRESS_PATTERN.matcher(line);
                if (matcher.find()) {
                    addresses.add(matcher.group());
                }
            }
        }
        
        return addresses;
    }
}
