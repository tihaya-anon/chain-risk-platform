package com.chainrisk.batch.job.fetcher;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Fetches known exchange addresses.
 * 
 * Exchange addresses are used as NEGATIVE samples (normal/legitimate addresses)
 * for ML training. These addresses have high transaction volumes but are
 * legitimate financial services.
 * 
 * Sources:
 * - Hardcoded list of known exchange hot/cold wallets
 * - Public Etherscan labels (requires API key or scraping)
 */
public class ExchangeFetcher implements LabelFetcher {
    private static final Logger LOG = LoggerFactory.getLogger(ExchangeFetcher.class);
    
    // Known exchange addresses (hot wallets and deposit addresses)
    // Source: Etherscan labels, exchange documentation
    private static final String[][] EXCHANGE_ADDRESSES = {
            // Binance
            {"0x28c6c06298d514db089934071355e5743bf21d60", "Binance", "Hot Wallet 14"},
            {"0x21a31ee1afc51d94c2efccaa2092ad1028285549", "Binance", "Hot Wallet 6"},
            {"0xdfd5293d8e347dfe59e90efd55b2956a1343963d", "Binance", "Hot Wallet 8"},
            {"0x56eddb7aa87536c09ccc2793473599fd21a8b17f", "Binance", "Hot Wallet 16"},
            {"0x9696f59e4d72e237be84ffd425dcad154bf96976", "Binance", "Hot Wallet 18"},
            {"0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67", "Binance", "Hot Wallet 19"},
            {"0xbe0eb53f46cd790cd13851d5eff43d12404d33e8", "Binance", "Cold Wallet"},
            {"0xf977814e90da44bfa03b6295a0616a897441acec", "Binance", "Hot Wallet"},
            
            // Coinbase
            {"0x71660c4005ba85c37ccec55d0c4493e66fe775d3", "Coinbase", "Hot Wallet 1"},
            {"0x503828976d22510aad0201ac7ec88293211d23da", "Coinbase", "Hot Wallet 2"},
            {"0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740", "Coinbase", "Hot Wallet 3"},
            {"0x3cd751e6b0078be393132286c442345e5dc49699", "Coinbase", "Hot Wallet 4"},
            {"0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511", "Coinbase", "Hot Wallet 5"},
            {"0xeb2629a2734e272bcc07bda959863f316f4bd4cf", "Coinbase", "Hot Wallet 6"},
            {"0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43", "Coinbase", "Cold Wallet"},
            
            // Kraken
            {"0x2910543af39aba0cd09dbb2d50200b3e800a63d2", "Kraken", "Hot Wallet 1"},
            {"0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13", "Kraken", "Hot Wallet 2"},
            {"0xe853c56864a2ebe4576a807d26fdc4a0ada51919", "Kraken", "Hot Wallet 3"},
            {"0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", "Kraken", "Hot Wallet 4"},
            
            // OKX (OKEx)
            {"0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", "OKX", "Hot Wallet 1"},
            {"0x236f9f97e0e62388479bf9e5ba4889e46b0273c3", "OKX", "Hot Wallet 2"},
            {"0xa7efae728d2936e78bda97dc267687568dd593f3", "OKX", "Hot Wallet 3"},
            
            // Huobi
            {"0xab5c66752a9e8167967685f1450532fb96d5d24f", "Huobi", "Hot Wallet 1"},
            {"0x6748f50f686bfbca6fe8ad62b22228b87f31ff2b", "Huobi", "Hot Wallet 2"},
            {"0xfdb16996831753d5331ff813c29a93c76834a0ad", "Huobi", "Hot Wallet 3"},
            {"0xeee28d484628d41a82d01e21d12e2e78d69920da", "Huobi", "Hot Wallet 4"},
            
            // Bitfinex
            {"0x876eabf441b2ee5b5b0554fd502a8e0600950cfa", "Bitfinex", "Hot Wallet 1"},
            {"0x742d35cc6634c0532925a3b844bc454e4438f44e", "Bitfinex", "Hot Wallet 2"},
            {"0xdcd0272462140d0a3ced6c4bf970c7641f08cd2c", "Bitfinex", "Hot Wallet 3"},
            
            // Gemini
            {"0xd24400ae8bfebb18ca49be86258a3c749cf46853", "Gemini", "Hot Wallet 1"},
            {"0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8", "Gemini", "Hot Wallet 2"},
            {"0x61edcdf5bb737adffe5043706e7c5bb1f1a56eea", "Gemini", "Hot Wallet 3"},
            
            // Kucoin
            {"0x2b5634c42055806a59e9107ed44d43c426e58258", "Kucoin", "Hot Wallet 1"},
            {"0x689c56aef474df92d44a1b70850f808488f9769c", "Kucoin", "Hot Wallet 2"},
            
            // Bittrex
            {"0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98", "Bittrex", "Hot Wallet 1"},
            {"0xe94b04a0fed112f3664e45adb2b8915693dd5ff3", "Bittrex", "Hot Wallet 2"},
            
            // Gate.io
            {"0x0d0707963952f2fba59dd06f2b425ace40b492fe", "Gate.io", "Hot Wallet 1"},
            {"0x7793cd85c11a924478d358d49b05b37e91b5810f", "Gate.io", "Hot Wallet 2"},
            
            // Crypto.com
            {"0x6262998ced04146fa42253a5c0af90ca02dfd2a3", "Crypto.com", "Hot Wallet 1"},
            {"0x46340b20830761efd32832a74d7169b29feb9758", "Crypto.com", "Hot Wallet 2"},
    };
    
    @Override
    public String getSourceName() {
        return "exchange";
    }
    
    @Override
    public List<LabelRecord> fetch() throws Exception {
        LOG.info("Fetching known exchange addresses");
        
        List<LabelRecord> records = new ArrayList<>();
        
        for (String[] entry : EXCHANGE_ADDRESSES) {
            String address = entry[0];
            String exchange = entry[1];
            String walletType = entry[2];
            
            records.add(new LabelRecord(
                    address,
                    "exchange",
                    exchange + " - " + walletType,
                    "exchange",
                    1.0
            ));
        }
        
        LOG.info("Added {} exchange addresses", records.size());
        
        return records;
    }
}
