package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
)

// FileStorage implements Storage using file system
// This is primarily used for fixture generation and testing
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
func (s *FileStorage) SaveBlock(ctx context.Context, blockNumber uint64, data json.RawMessage) error {
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
func (s *FileStorage) SaveInternalTx(ctx context.Context, txHash string, data json.RawMessage) error {
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
func (s *FileStorage) SaveAddressTxs(ctx context.Context, address string, startBlock, endBlock uint64, data json.RawMessage) error {
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
func (s *FileStorage) SaveManifest(ctx context.Context, manifest *Manifest) error {
	networkDir := filepath.Join(s.baseDir, s.network)
	path := filepath.Join(networkDir, "manifest.json")

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal manifest: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// LoadManifest loads the manifest file
func (s *FileStorage) LoadManifest(ctx context.Context) (*Manifest, error) {
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

// SaveTransaction is not supported by FileStorage (use PostgresStorage for structured data)
func (s *FileStorage) SaveTransaction(ctx context.Context, network string, tx *model.Transaction) error {
	return fmt.Errorf("SaveTransaction not supported by FileStorage, use PostgresStorage")
}

// SaveTransactions is not supported by FileStorage
func (s *FileStorage) SaveTransactions(ctx context.Context, network string, txs []*model.Transaction) error {
	return fmt.Errorf("SaveTransactions not supported by FileStorage, use PostgresStorage")
}

// SaveTransfer is not supported by FileStorage
func (s *FileStorage) SaveTransfer(ctx context.Context, network string, transfer *model.Transfer) error {
	return fmt.Errorf("SaveTransfer not supported by FileStorage, use PostgresStorage")
}

// SaveTransfers is not supported by FileStorage
func (s *FileStorage) SaveTransfers(ctx context.Context, network string, transfers []*model.Transfer) error {
	return fmt.Errorf("SaveTransfers not supported by FileStorage, use PostgresStorage")
}

// GetLastProcessedBlock returns 0 for FileStorage (not supported)
func (s *FileStorage) GetLastProcessedBlock(ctx context.Context, network, processorType string) (uint64, error) {
	return 0, nil
}

// SetLastProcessedBlock is a no-op for FileStorage
func (s *FileStorage) SetLastProcessedBlock(ctx context.Context, network, processorType string, blockNumber uint64) error {
	return nil
}

// Close is a no-op for FileStorage
func (s *FileStorage) Close() error {
	return nil
}
