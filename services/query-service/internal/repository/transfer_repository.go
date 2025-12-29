package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/0ksks/chain-risk-platform/query-service/internal/model"
	"gorm.io/gorm"
)

// TransferRepository handles database operations for transfers
type TransferRepository struct {
	db *gorm.DB
}

// NewTransferRepository creates a new TransferRepository
func NewTransferRepository(db *gorm.DB) *TransferRepository {
	return &TransferRepository{db: db}
}

// GetByID retrieves a transfer by ID
func (r *TransferRepository) GetByID(ctx context.Context, id int64) (*model.Transfer, error) {
	var transfer model.Transfer
	result := r.db.WithContext(ctx).First(&transfer, id)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, fmt.Errorf("get transfer by id: %w", result.Error)
	}
	return &transfer, nil
}

// GetByTxHash retrieves transfers by transaction hash
func (r *TransferRepository) GetByTxHash(ctx context.Context, txHash string) ([]model.Transfer, error) {
	var transfers []model.Transfer
	result := r.db.WithContext(ctx).
		Where("tx_hash = ?", txHash).
		Order("log_index ASC").
		Find(&transfers)
	if result.Error != nil {
		return nil, fmt.Errorf("get transfers by tx hash: %w", result.Error)
	}
	return transfers, nil
}

// List retrieves transfers with filters and pagination
func (r *TransferRepository) List(ctx context.Context, filter model.TransferFilter, page, pageSize int) ([]model.Transfer, int64, error) {
	var transfers []model.Transfer
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Transfer{})

	// Apply filters
	query = r.applyFilters(query, filter)

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count transfers: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * pageSize
	result := query.
		Order("timestamp DESC, id DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&transfers)

	if result.Error != nil {
		return nil, 0, fmt.Errorf("list transfers: %w", result.Error)
	}

	return transfers, total, nil
}

// GetByAddress retrieves transfers for a specific address (sent or received)
func (r *TransferRepository) GetByAddress(ctx context.Context, address string, filter model.TransferFilter, page, pageSize int) ([]model.Transfer, int64, error) {
	var transfers []model.Transfer
	var total int64

	query := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Where("from_address = ? OR to_address = ?", address, address)

	// Apply additional filters
	query = r.applyFilters(query, filter)

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count address transfers: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * pageSize
	result := query.
		Order("timestamp DESC, id DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&transfers)

	if result.Error != nil {
		return nil, 0, fmt.Errorf("get address transfers: %w", result.Error)
	}

	return transfers, total, nil
}

// GetAddressInfo retrieves aggregated information for an address
func (r *TransferRepository) GetAddressInfo(ctx context.Context, address, network string) (*model.AddressInfo, error) {
	var info model.AddressInfo
	info.Address = address
	info.Network = network

	// Get sent count
	var sentCount int64
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Where("from_address = ? AND network = ?", address, network).
		Count(&sentCount).Error; err != nil {
		return nil, fmt.Errorf("count sent: %w", err)
	}
	info.SentTxCount = sentCount

	// Get received count
	var receivedCount int64
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Where("to_address = ? AND network = ?", address, network).
		Count(&receivedCount).Error; err != nil {
		return nil, fmt.Errorf("count received: %w", err)
	}
	info.ReceivedTxCount = receivedCount
	info.TotalTxCount = sentCount + receivedCount

	if info.TotalTxCount == 0 {
		return nil, nil // Address not found
	}

	// Get first and last seen
	type TimeResult struct {
		FirstSeen time.Time
		LastSeen  time.Time
	}
	var timeResult TimeResult
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Select("MIN(timestamp) as first_seen, MAX(timestamp) as last_seen").
		Where("(from_address = ? OR to_address = ?) AND network = ?", address, address, network).
		Scan(&timeResult).Error; err != nil {
		return nil, fmt.Errorf("get time range: %w", err)
	}
	info.FirstSeen = timeResult.FirstSeen
	info.LastSeen = timeResult.LastSeen

	// Get unique interacted addresses
	var uniqueCount int64
	if err := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(DISTINCT counterparty) FROM (
			SELECT to_address as counterparty FROM chain_data.transfers 
			WHERE from_address = ? AND network = ?
			UNION
			SELECT from_address as counterparty FROM chain_data.transfers 
			WHERE to_address = ? AND network = ?
		) AS counterparties
	`, address, network, address, network).Scan(&uniqueCount).Error; err != nil {
		return nil, fmt.Errorf("count unique interacted: %w", err)
	}
	info.UniqueInteracted = uniqueCount

	return &info, nil
}

// GetAddressStats retrieves value statistics for an address
func (r *TransferRepository) GetAddressStats(ctx context.Context, address, network string) (*model.AddressStats, error) {
	var stats model.AddressStats

	// Get sent stats
	type ValueStats struct {
		TotalValue string
		AvgValue   string
		MaxValue   string
		MinValue   string
	}

	var sentStats ValueStats
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Select("COALESCE(SUM(value::numeric), 0)::text as total_value").
		Where("from_address = ? AND network = ? AND transfer_type = 'native'", address, network).
		Scan(&sentStats).Error; err != nil {
		return nil, fmt.Errorf("get sent stats: %w", err)
	}
	stats.TotalValueSent = sentStats.TotalValue

	var receivedStats ValueStats
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Select("COALESCE(SUM(value::numeric), 0)::text as total_value").
		Where("to_address = ? AND network = ? AND transfer_type = 'native'", address, network).
		Scan(&receivedStats).Error; err != nil {
		return nil, fmt.Errorf("get received stats: %w", err)
	}
	stats.TotalValueReceived = receivedStats.TotalValue

	// Get overall stats
	var overallStats ValueStats
	if err := r.db.WithContext(ctx).Model(&model.Transfer{}).
		Select(`
			COALESCE(AVG(value::numeric), 0)::text as avg_value,
			COALESCE(MAX(value::numeric), 0)::text as max_value,
			COALESCE(MIN(value::numeric), 0)::text as min_value
		`).
		Where("(from_address = ? OR to_address = ?) AND network = ? AND transfer_type = 'native'", address, address, network).
		Scan(&overallStats).Error; err != nil {
		return nil, fmt.Errorf("get overall stats: %w", err)
	}
	stats.AvgTxValue = overallStats.AvgValue
	stats.MaxTxValue = overallStats.MaxValue
	stats.MinTxValue = overallStats.MinValue

	return &stats, nil
}

// applyFilters applies filter conditions to the query
func (r *TransferRepository) applyFilters(query *gorm.DB, filter model.TransferFilter) *gorm.DB {
	if filter.Address != "" {
		query = query.Where("from_address = ? OR to_address = ?", filter.Address, filter.Address)
	}
	if filter.FromAddress != "" {
		query = query.Where("from_address = ?", filter.FromAddress)
	}
	if filter.ToAddress != "" {
		query = query.Where("to_address = ?", filter.ToAddress)
	}
	if filter.TokenAddress != "" {
		query = query.Where("token_address = ?", filter.TokenAddress)
	}
	if filter.TransferType != "" {
		query = query.Where("transfer_type = ?", filter.TransferType)
	}
	if filter.Network != "" {
		query = query.Where("network = ?", filter.Network)
	}
	if filter.StartTime != "" {
		if t, err := time.Parse(time.RFC3339, filter.StartTime); err == nil {
			query = query.Where("timestamp >= ?", t)
		}
	}
	if filter.EndTime != "" {
		if t, err := time.Parse(time.RFC3339, filter.EndTime); err == nil {
			query = query.Where("timestamp <= ?", t)
		}
	}
	if filter.MinValue != "" {
		query = query.Where("value::numeric >= ?::numeric", filter.MinValue)
	}
	if filter.MaxValue != "" {
		query = query.Where("value::numeric <= ?::numeric", filter.MaxValue)
	}

	return query
}
