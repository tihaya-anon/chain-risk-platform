# Crypto Risk Taxonomy

> Reference list for blockchain risk detection. Research keywords independently.

---

## On-chain Risk (Post-confirmation)

Risks detectable from confirmed blockchain data.

### AML / Sanctions

| Risk | Description | Keywords |
|------|-------------|----------|
| Mixer Usage | Funds passed through mixing services | Tornado Cash, Wasabi, CoinJoin |
| Sanctioned Address | Interaction with OFAC/SDN listed addresses | OFAC SDN, sanctions screening |
| Darknet Market | Funds from/to darknet marketplaces | Hydra, Silk Road |
| Ransomware | Addresses linked to ransomware payments | ransom wallet, extortion |
| Terrorism Financing | Flagged by intel agencies | TF risk, watchlist |

### Fraud / Scam

| Risk | Description | Keywords |
|------|-------------|----------|
| Rug Pull | Project team drains liquidity | rug pull, liquidity removal |
| Phishing | Funds stolen via fake approvals | approval phishing, ice phishing |
| Ponzi / Pyramid | Unsustainable yield schemes | Ponzi, pyramid scheme |
| Romance Scam | Pig butchering scams | pig butchering, romance scam |
| Fake Token | Counterfeit tokens mimicking real ones | honeypot token, fake airdrop |

### Graph Patterns (Laundering)

| Pattern | Description | Keywords |
|---------|-------------|----------|
| Peel Chain | Sequential small withdrawals | peel chain, peeling |
| Fan-out | One address splits to many | fan-out, distribution |
| Fan-in | Many addresses consolidate to one | fan-in, collection |
| Layering | Multiple hops to obscure origin | layering, obfuscation |
| Smurfing | Breaking large amounts into small txs | smurfing, structuring |
| Chain Hopping | Cross-chain transfers to evade tracking | bridge exploit, cross-chain |

### Protocol Exploits

| Risk | Description | Keywords |
|------|-------------|----------|
| Smart Contract Exploit | Exploited vulnerability in contract | reentrancy, overflow, access control |
| Bridge Hack | Cross-chain bridge compromised | bridge exploit, Ronin, Wormhole |
| Oracle Manipulation | Price feed manipulation | oracle attack, price manipulation |
| Governance Attack | Malicious governance proposal | flash loan governance, vote buying |

---

## Transaction Risk (Pre-confirmation / Mempool)

Risks detectable from pending transactions.

### MEV (Maximal Extractable Value)

| Risk | Description | Keywords |
|------|-------------|----------|
| Sandwich Attack | Buy before victim, sell after | sandwich, frontrun+backrun |
| Front-running | Execute before target tx | front-run, priority gas auction |
| Back-running | Execute immediately after target | back-run, arbitrage |
| JIT Liquidity | Just-in-time liquidity provision | JIT, liquidity sniping |
| Liquidation MEV | Racing to liquidate positions | liquidation bot, MEV liquidation |

### Market Manipulation

| Risk | Description | Keywords |
|------|-------------|----------|
| Wash Trading | Self-trading to inflate volume | wash trade, fake volume |
| Spoofing | Fake orders to mislead | spoofing, layering orders |
| Pump and Dump | Coordinated price manipulation | pump and dump, P&D |
| Quote Stuffing | Flood orderbook with noise | quote stuffing |

### Abnormal Behavior

| Risk | Description | Keywords |
|------|-------------|----------|
| Gas War | Abnormally high gas bidding | gas war, priority fee spike |
| Bot Activity | Automated aggressive trading | trading bot, sniper bot |
| Flash Loan | Large uncollateralized borrow | flash loan, atomic arbitrage |
| Mempool Spam | DoS via pending tx flood | mempool spam, tx flooding |

---

## Address Labels

Common address categorizations.

| Category | Examples |
|----------|----------|
| Exchange | Binance, Coinbase hot/cold wallets |
| DeFi Protocol | Uniswap, Aave, Compound contracts |
| Bridge | Multichain, Wormhole, LayerZero |
| Mixer | Tornado Cash, Aztec |
| NFT Marketplace | OpenSea, Blur |
| Gambling | Online casinos, betting |
| Mining Pool | Ethermine, F2Pool |
| Sanctioned | OFAC designated addresses |
| Exploiter | Known hack/exploit addresses |
| Scam | Confirmed scam addresses |

---

## References

| Source | URL | Content |
|--------|-----|---------|
| Chainalysis | chainalysis.com | Reports, typologies |
| Elliptic | elliptic.co | Research, patterns |
| OFAC | treasury.gov/ofac | Sanctions list |
| Flashbots | flashbots.net | MEV research |
| Etherscan Labels | etherscan.io/labelcloud | Address tags |
| Arkham Intel | arkhamintelligence.com | On-chain investigation |
| Nansen | nansen.ai | Wallet labels |
| Rekt News | rekt.news | Exploit postmortems |

---

**Created**: 2026-01-14
