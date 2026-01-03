package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// PostgresStorage implements Storage using PostgreSQL
type PostgresStorage struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

// PostgresConfig holds PostgreSQL connection configuration
type PostgresConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	Database        string
	SSLMode         string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
}

// LoadPostgresConfigFromEnv loads PostgreSQL configuration from environment variables
func LoadPostgresConfigFromEnv() *PostgresConfig {
	port, _ := strconv.Atoi(getEnvOrDefault("POSTGRES_PORT", "5432"))
	maxConns, _ := strconv.Atoi(getEnvOrDefault("POSTGRES_MAX_CONNS", "10"))
	minConns, _ := strconv.Atoi(getEnvOrDefault("POSTGRES_MIN_CONNS", "2"))
	maxConnLifetime, _ := strconv.Atoi(getEnvOrDefault("POSTGRES_MAX_CONN_LIFETIME", "3600"))
	maxConnIdleTime, _ := strconv.Atoi(getEnvOrDefault("POSTGRES_MAX_CONN_IDLE_TIME", "300"))

	return &PostgresConfig{
		Host:            getEnvOrDefault("POSTGRES_HOST", "localhost"),
		Port:            port,
		User:            getEnvOrDefault("POSTGRES_USER", "chainrisk"),
		Password:        getEnvOrDefault("POSTGRES_PASSWORD", "chainrisk123"),
		Database:        getEnvOrDefault("POSTGRES_DB", "chainrisk"),
		SSLMode:         getEnvOrDefault("POSTGRES_SSLMODE", "disable"),
		MaxConns:        int32(maxConns),
		MinConns:        int32(minConns),
		MaxConnLifetime: time.Duration(maxConnLifetime) * time.Second,
		MaxConnIdleTime: time.Duration(maxConnIdleTime) * time.Second,
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// DSN returns the PostgreSQL connection string
func (c *PostgresConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Database, c.SSLMode)
}

// NewPostgresStorage creates a new PostgreSQL storage
func NewPostgresStorage(ctx context.Context, logger *zap.Logger) (*PostgresStorage, error) {
	cfg := LoadPostgresConfigFromEnv()
	return NewPostgresStorageWithConfig(ctx, cfg, logger)
}

// NewPostgresStorageWithConfig creates a new PostgreSQL storage with explicit config
func NewPostgresStorageWithConfig(ctx context.Context, cfg *PostgresConfig, logger *zap.Logger) (*PostgresStorage, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}

	poolConfig.MaxConns = cfg.MaxConns
	poolConfig.MinConns = cfg.MinConns
	poolConfig.MaxConnLifetime = cfg.MaxConnLifetime
	poolConfig.MaxConnIdleTime = cfg.MaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	logger.Info("Connected to PostgreSQL",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("database", cfg.Database))

	return &PostgresStorage{
		pool:   pool,
		logger: logger,
	}, nil
}

// SaveBlock saves raw block data (stored as JSONB for reference)
func (s *PostgresStorage) SaveBlock(ctx context.Context, blockNumber uint64, data json.RawMessage) error {
	// For PostgresStorage, we primarily use structured data storage
	// Raw block data can be stored in a separate table if needed
	s.logger.Debug("SaveBlock called - raw data storage not implemented for PostgresStorage",
		zap.Uint64("blockNumber", blockNumber))
	return nil
}

// SaveInternalTx saves raw internal transaction data
func (s *PostgresStorage) SaveInternalTx(ctx context.Context, txHash string, data json.RawMessage) error {
	s.logger.Debug("SaveInternalTx called - raw data storage not implemented for PostgresStorage",
		zap.String("txHash", txHash))
	return nil
}

// SaveAddressTxs saves raw address transaction data
func (s *PostgresStorage) SaveAddressTxs(ctx context.Context, address string, startBlock, endBlock uint64, data json.RawMessage) error {
	s.logger.Debug("SaveAddressTxs called - raw data storage not implemented for PostgresStorage",
		zap.String("address", address))
	return nil
}

// SaveManifest saves the manifest (not applicable for PostgresStorage)
func (s *PostgresStorage) SaveManifest(ctx context.Context, manifest *Manifest) error {
	s.logger.Debug("SaveManifest called - not applicable for PostgresStorage")
	return nil
}

// LoadManifest loads the manifest (not applicable for PostgresStorage)
func (s *PostgresStorage) LoadManifest(ctx context.Context) (*Manifest, error) {
	return &Manifest{
		Version:     "1.0",
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		APISource:   "postgres",
	}, nil
}

// SaveTransaction saves a single transaction to the database
func (s *PostgresStorage) SaveTransaction(ctx context.Context, network string, tx *model.Transaction) error {
	query := `
		INSERT INTO chain_data.transactions (
			hash, block_number, block_hash, transaction_index,
			from_address, to_address, value, gas, gas_price, gas_used,
			nonce, input, timestamp, is_error, contract_address, network
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		ON CONFLICT (hash) DO UPDATE SET
			gas_used = EXCLUDED.gas_used,
			is_error = EXCLUDED.is_error
	`

	var value, gasPrice string
	if tx.Value != nil {
		value = tx.Value.String()
	}
	if tx.GasPrice != nil {
		gasPrice = tx.GasPrice.String()
	}

	_, err := s.pool.Exec(ctx, query,
		tx.Hash,
		tx.BlockNumber,
		tx.BlockHash,
		tx.TransactionIndex,
		tx.From,
		tx.To,
		value,
		tx.Gas,
		gasPrice,
		tx.GasUsed,
		tx.Nonce,
		tx.Input,
		tx.Timestamp,
		tx.IsError,
		tx.ContractAddress,
		network,
	)
	if err != nil {
		return fmt.Errorf("insert transaction %s: %w", tx.Hash, err)
	}

	return nil
}

// SaveTransactions saves multiple transactions in a batch
func (s *PostgresStorage) SaveTransactions(ctx context.Context, network string, txs []*model.Transaction) error {
	if len(txs) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO chain_data.transactions (
			hash, block_number, block_hash, transaction_index,
			from_address, to_address, value, gas, gas_price, gas_used,
			nonce, input, timestamp, is_error, contract_address, network
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		ON CONFLICT (hash) DO UPDATE SET
			gas_used = EXCLUDED.gas_used,
			is_error = EXCLUDED.is_error
	`

	for _, tx := range txs {
		var value, gasPrice string
		if tx.Value != nil {
			value = tx.Value.String()
		}
		if tx.GasPrice != nil {
			gasPrice = tx.GasPrice.String()
		}

		batch.Queue(query,
			tx.Hash,
			tx.BlockNumber,
			tx.BlockHash,
			tx.TransactionIndex,
			tx.From,
			tx.To,
			value,
			tx.Gas,
			gasPrice,
			tx.GasUsed,
			tx.Nonce,
			tx.Input,
			tx.Timestamp,
			tx.IsError,
			tx.ContractAddress,
			network,
		)
	}

	results := s.pool.SendBatch(ctx, batch)
	defer results.Close()

	for i := 0; i < len(txs); i++ {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("batch insert transaction %d: %w", i, err)
		}
	}

	s.logger.Debug("Saved transactions batch",
		zap.Int("count", len(txs)),
		zap.String("network", network))

	return nil
}

// SaveTransfer saves a single transfer to the database
func (s *PostgresStorage) SaveTransfer(ctx context.Context, network string, transfer *model.Transfer) error {
	query := `
		INSERT INTO chain_data.transfers (
			tx_hash, block_number, log_index, from_address, to_address,
			value, token_address, token_symbol, token_decimal,
			timestamp, transfer_type, network
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		ON CONFLICT (tx_hash, log_index) DO NOTHING
	`

	var value string
	if transfer.Value != nil {
		value = transfer.Value.String()
	}

	var tokenDecimal *int
	if transfer.TokenDecimal > 0 {
		td := int(transfer.TokenDecimal)
		tokenDecimal = &td
	}

	var tokenAddress *string
	if transfer.TokenAddress != "" {
		tokenAddress = &transfer.TokenAddress
	}

	var tokenSymbol *string
	if transfer.TokenSymbol != "" {
		tokenSymbol = &transfer.TokenSymbol
	}

	_, err := s.pool.Exec(ctx, query,
		transfer.TxHash,
		transfer.BlockNumber,
		transfer.LogIndex,
		transfer.From,
		transfer.To,
		value,
		tokenAddress,
		tokenSymbol,
		tokenDecimal,
		transfer.Timestamp,
		transfer.TransferType,
		network,
	)
	if err != nil {
		return fmt.Errorf("insert transfer %s-%d: %w", transfer.TxHash, transfer.LogIndex, err)
	}

	return nil
}

// SaveTransfers saves multiple transfers in a batch
func (s *PostgresStorage) SaveTransfers(ctx context.Context, network string, transfers []*model.Transfer) error {
	if len(transfers) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO chain_data.transfers (
			tx_hash, block_number, log_index, from_address, to_address,
			value, token_address, token_symbol, token_decimal,
			timestamp, transfer_type, network
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		)
		ON CONFLICT (tx_hash, log_index) DO NOTHING
	`

	for _, transfer := range transfers {
		var value string
		if transfer.Value != nil {
			value = transfer.Value.String()
		}

		var tokenDecimal *int
		if transfer.TokenDecimal > 0 {
			td := int(transfer.TokenDecimal)
			tokenDecimal = &td
		}

		var tokenAddress *string
		if transfer.TokenAddress != "" {
			tokenAddress = &transfer.TokenAddress
		}

		var tokenSymbol *string
		if transfer.TokenSymbol != "" {
			tokenSymbol = &transfer.TokenSymbol
		}

		batch.Queue(query,
			transfer.TxHash,
			transfer.BlockNumber,
			transfer.LogIndex,
			transfer.From,
			transfer.To,
			value,
			tokenAddress,
			tokenSymbol,
			tokenDecimal,
			transfer.Timestamp,
			transfer.TransferType,
			network,
		)
	}

	results := s.pool.SendBatch(ctx, batch)
	defer results.Close()

	for i := 0; i < len(transfers); i++ {
		if _, err := results.Exec(); err != nil {
			return fmt.Errorf("batch insert transfer %d: %w", i, err)
		}
	}

	s.logger.Debug("Saved transfers batch",
		zap.Int("count", len(transfers)),
		zap.String("network", network))

	return nil
}

// GetLastProcessedBlock returns the last processed block number for a processor
func (s *PostgresStorage) GetLastProcessedBlock(ctx context.Context, network, processorType string) (uint64, error) {
	query := `
		SELECT last_processed_block 
		FROM chain_data.processing_state 
		WHERE id = $1 AND network = $2 AND processor_type = $3
	`

	id := fmt.Sprintf("%s-%s", network, processorType)
	var blockNumber uint64

	err := s.pool.QueryRow(ctx, query, id, network, processorType).Scan(&blockNumber)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, nil
		}
		return 0, fmt.Errorf("get last processed block: %w", err)
	}

	return blockNumber, nil
}

// SetLastProcessedBlock updates the last processed block number
func (s *PostgresStorage) SetLastProcessedBlock(ctx context.Context, network, processorType string, blockNumber uint64) error {
	query := `
		INSERT INTO chain_data.processing_state (id, last_processed_block, network, processor_type, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		ON CONFLICT (id) DO UPDATE SET
			last_processed_block = EXCLUDED.last_processed_block,
			updated_at = CURRENT_TIMESTAMP
	`

	id := fmt.Sprintf("%s-%s", network, processorType)

	_, err := s.pool.Exec(ctx, query, id, blockNumber, network, processorType)
	if err != nil {
		return fmt.Errorf("set last processed block: %w", err)
	}

	return nil
}

// Close closes the database connection pool
func (s *PostgresStorage) Close() error {
	s.pool.Close()
	s.logger.Info("PostgreSQL connection pool closed")
	return nil
}

// Pool returns the underlying connection pool for advanced operations
func (s *PostgresStorage) Pool() *pgxpool.Pool {
	return s.pool
}
