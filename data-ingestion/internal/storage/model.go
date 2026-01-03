package storage

// Manifest tracks all fetched fixtures
type Manifest struct {
	Version     string            `json:"version"`
	GeneratedAt string            `json:"generatedAt"`
	Network     string            `json:"network"`
	APISource   string            `json:"apiSource"`
	Blocks      []BlockManifest   `json:"blocks,omitempty"`
	Addresses   []AddressManifest `json:"addresses,omitempty"`
}

// BlockManifest contains metadata about a fetched block
type BlockManifest struct {
	Number      uint64 `json:"number"`
	Hash        string `json:"hash"`
	TxCount     int    `json:"txCount"`
	Timestamp   string `json:"timestamp"`
	FixtureFile string `json:"fixtureFile"`
}

// AddressManifest contains metadata about fetched address transactions
type AddressManifest struct {
	Address     string `json:"address"`
	StartBlock  uint64 `json:"startBlock"`
	EndBlock    uint64 `json:"endBlock"`
	TxCount     int    `json:"txCount"`
	FixtureFile string `json:"fixtureFile"`
}
