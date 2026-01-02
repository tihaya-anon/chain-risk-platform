# Test Fixtures

This directory contains test fixtures generated from real blockchain API responses.

## Directory Structure

```
fixtures/
├── ethereum/
│   ├── manifest.json      # Index of all fixtures with metadata
│   ├── blocks/            # Block data by block number
│   │   └── {blockNumber}.json
│   ├── addresses/         # Address transaction data
│   │   └── {address}_{startBlock}_{endBlock}.json
│   └── internal_txs/      # Internal transactions by tx hash
│       └── {txHash}.json
└── README.md
```

## Generating Fixtures

Use the `fixture-gen` tool to fetch real API responses:

```bash
cd data-ingestion

# Fetch specific blocks
go run ./cmd/fixture-gen -network ethereum -blocks 19000000,19000001,19000002

# Fetch latest N blocks
go run ./cmd/fixture-gen -network ethereum -latest 5

# Fetch blocks in a range
go run ./cmd/fixture-gen -network ethereum -start-block 19000000 -end-block 19000010

# Fetch address transactions
go run ./cmd/fixture-gen -network ethereum \
  -address 0xdAC17F958D2ee523a2206206994597C13D831ec7 \
  -start-block 19000000 -end-block 19000100

# Fetch with custom output directory
go run ./cmd/fixture-gen -network ethereum -blocks 19000000 \
  -output ../tests/integration/fixtures

# Skip internal transactions (faster)
go run ./cmd/fixture-gen -network ethereum -blocks 19000000 -internal-txs=false
```

### Environment Variables

Set your API key before running:

```bash
export ETHERSCAN_API_KEY=your_api_key
export BSCSCAN_API_KEY=your_api_key  # for BSC network
```

Or pass it directly:

```bash
go run ./cmd/fixture-gen -network ethereum -api-key YOUR_KEY -blocks 19000000
```

## Fixture Format

### Block Fixture (`blocks/{blockNumber}.json`)

```json
{
  "network": "ethereum",
  "blockNumber": 19000000,
  "fetchedAt": "2024-01-15T10:30:00Z",
  "blockResponse": { /* raw API response */ },
  "internalTxs": {
    "0x...txhash1": { /* internal tx response */ },
    "0x...txhash2": { /* internal tx response */ }
  }
}
```

### Address Fixture (`addresses/{address}_{start}_{end}.json`)

```json
{
  "network": "ethereum",
  "address": "0x...",
  "startBlock": 19000000,
  "endBlock": 19000100,
  "fetchedAt": "2024-01-15T10:30:00Z",
  "txListResponse": { /* raw API response */ }
}
```

### Manifest (`manifest.json`)

```json
{
  "version": "1.0",
  "generatedAt": "2024-01-15T10:30:00Z",
  "network": "ethereum",
  "apiSource": "https://api.etherscan.io/api",
  "blocks": [
    {
      "number": 19000000,
      "hash": "0x...",
      "txCount": 150,
      "timestamp": "0x...",
      "fixtureFile": "blocks/19000000.json"
    }
  ],
  "addresses": [
    {
      "address": "0x...",
      "startBlock": 19000000,
      "endBlock": 19000100,
      "txCount": 50,
      "fixtureFile": "addresses/0x..._19000000_19000100.json"
    }
  ]
}
```

## Using Fixtures in Tests

The mock server reads these fixtures and serves them as API responses:

```bash
cd tests/integration/mock_server
go run . -fixtures ../fixtures/ethereum -port 8545
```

Then configure your service to use the mock server:

```bash
export ETHERSCAN_BASE_URL=http://localhost:8545/api?
```

## Best Practices

1. **Version Control**: Commit fixtures to git for reproducible tests
2. **Selective Fetching**: Only fetch blocks/addresses needed for specific test cases
3. **Rate Limiting**: Use `-rate-limit` flag to avoid API throttling
4. **Documentation**: Update manifest with notes about test scenarios
5. **Refresh Periodically**: Re-fetch fixtures if API response format changes
