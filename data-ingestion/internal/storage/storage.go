package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
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

// FileStorage implements Storage using file system
type FileStorage struct {
	baseDir      string
	network      string
	blocksDir    string
	addressesDir string
	internalDir  string
}

// NewFileStorage creates a new file storage
func NewFileStorage(baseDir, network string) (*FileStorage, error) {
	networkDir := filepath.Join(baseDir, network)
	blocksDir := filepath.Join(networkDir, "blocks")
	addressesDir := filepath.Join(networkDir, "addresses")
	internalDir := filepath.Join(networkDir, "internal_txs")

	// Create directories
	for _, dir := range []string{blocksDir, addressesDir, internalDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create directory %s: %w", dir, err)
		}
	}

	return &FileStorage{
		baseDir:      baseDir,
		network:      network,
		blocksDir:    blocksDir,
		addressesDir: addressesDir,
		internalDir:  internalDir,
	}, nil
}

// SaveBlock saves raw block data
func (s *FileStorage) SaveBlock(blockNumber uint64, data json.RawMessage) error {
	filename := fmt.Sprintf("%d.json", blockNumber)
	path := filepath.Join(s.blocksDir, filename)

	// Pretty print JSON
	var prettyData interface{}
	if err := json.Unmarshal(data, &prettyData); err != nil {
		return fmt.Errorf("unmarshal data: %w", err)
	}

	formatted, err := json.MarshalIndent(prettyData, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal data: %w", err)
	}

	return os.WriteFile(path, formatted, 0644)
}

// SaveInternalTx saves raw internal transaction data
func (s *FileStorage) SaveInternalTx(txHash string, data json.RawMessage) error {
	filename := fmt.Sprintf("%s.json", txHash)
	path := filepath.Join(s.internalDir, filename)

	// Pretty print JSON
	var prettyData interface{}
	if err := json.Unmarshal(data, &prettyData); err != nil {
		return fmt.Errorf("unmarshal data: %w", err)
	}

	formatted, err := json.MarshalIndent(prettyData, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal data: %w", err)
	}

	return os.WriteFile(path, formatted, 0644)
}

// SaveAddressTxs saves raw address transaction data
func (s *FileStorage) SaveAddressTxs(address string, startBlock, endBlock uint64, data json.RawMessage) error {
	filename := fmt.Sprintf("%s_%d_%d.json", address, startBlock, endBlock)
	path := filepath.Join(s.addressesDir, filename)

	// Pretty print JSON
	var prettyData interface{}
	if err := json.Unmarshal(data, &prettyData); err != nil {
		return fmt.Errorf("unmarshal data: %w", err)
	}

	formatted, err := json.MarshalIndent(prettyData, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal data: %w", err)
	}

	return os.WriteFile(path, formatted, 0644)
}

// SaveManifest saves the manifest file
func (s *FileStorage) SaveManifest(manifest *Manifest) error {
	networkDir := filepath.Join(s.baseDir, s.network)
	path := filepath.Join(networkDir, "manifest.json")

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// LoadManifest loads the manifest file
func (s *FileStorage) LoadManifest() (*Manifest, error) {
	networkDir := filepath.Join(s.baseDir, s.network)
	path := filepath.Join(networkDir, "manifest.json")

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty manifest if file doesn't exist
			return &Manifest{
				Version:     "1.0",
				GeneratedAt: time.Now().UTC().Format(time.RFC3339),
				Network:     s.network,
			}, nil
		}
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("unmarshal manifest: %w", err)
	}

	return &manifest, nil
}

// Manifest tracks all fetched fixtures
type Manifest struct {
	Version     string            `json:"version"`
	GeneratedAt string            `json:"generatedAt"`
	Network     string            `json:"network"`
	APISource   string            `json:"apiSource"`
	Blocks      []BlockManifest   `json:"blocks,omitempty"`
	Addresses   []AddressManifest `json:"addresses,omitempty"`
}

type BlockManifest struct {
	Number      uint64 `json:"number"`
	Hash        string `json:"hash"`
	TxCount     int    `json:"txCount"`
	Timestamp   string `json:"timestamp"`
	FixtureFile string `json:"fixtureFile"`
}

type AddressManifest struct {
	Address     string `json:"address"`
	StartBlock  uint64 `json:"startBlock"`
	EndBlock    uint64 `json:"endBlock"`
	TxCount     int    `json:"txCount"`
	FixtureFile string `json:"fixtureFile"`
}
