package storage

import (
	"encoding/json"
)

// Storage handles persistence of fetched data
type Storage interface {
	// SaveBlock saves raw block data
	SaveBlock(blockNumber uint64, data json.RawMessage) error

	// SaveInternalTx saves raw internal transaction data
	SaveInternalTx(txHash string, data json.RawMessage) error

	// SaveAddressTxs saves raw address transaction data
	SaveAddressTxs(address string, startBlock, endBlock uint64, data json.RawMessage) error

	// SaveManifest saves the manifest file
	SaveManifest(manifest *Manifest) error

	// LoadManifest loads the manifest file
	LoadManifest() (*Manifest, error)
}
