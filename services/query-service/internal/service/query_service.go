package service

import (
	"context"
	"fmt"

	"github.com/0ksks/chain-risk-platform/query-service/internal/config"
	"github.com/0ksks/chain-risk-platform/query-service/internal/model"
	"github.com/0ksks/chain-risk-platform/query-service/internal/repository"
	"github.com/0ksks/chain-risk-platform/query-service/pkg/cache"
	"github.com/go-redis/redis/v8"
	"go.uber.org/zap"
)

// QueryService provides business logic for querying blockchain data
type QueryService struct {
	transferRepo *repository.TransferRepository
	cache        *cache.RedisCache
	config       *config.Config
	logger       *zap.Logger
}

// NewQueryService creates a new QueryService
func NewQueryService(
	transferRepo *repository.TransferRepository,
	redisClient *redis.Client,
	cfg *config.Config,
	logger *zap.Logger,
) *QueryService {
	var redisCache *cache.RedisCache
	if redisClient != nil {
		redisCache = cache.NewRedisCache(redisClient)
	}

	return &QueryService{
		transferRepo: transferRepo,
		cache:        redisCache,
		config:       cfg,
		logger:       logger,
	}
}

// GetTransfer retrieves a single transfer by ID
func (s *QueryService) GetTransfer(ctx context.Context, id int64) (*model.TransferResponse, error) {
	transfer, err := s.transferRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get transfer: %w", err)
	}
	if transfer == nil {
		return nil, nil
	}

	resp := transfer.ToResponse()
	return &resp, nil
}

// GetTransfersByTxHash retrieves all transfers for a transaction
func (s *QueryService) GetTransfersByTxHash(ctx context.Context, txHash string) ([]model.TransferResponse, error) {
	transfers, err := s.transferRepo.GetByTxHash(ctx, txHash)
	if err != nil {
		return nil, fmt.Errorf("get transfers by tx hash: %w", err)
	}

	responses := make([]model.TransferResponse, len(transfers))
	for i, t := range transfers {
		responses[i] = t.ToResponse()
	}

	return responses, nil
}

// ListTransfers retrieves transfers with filters and pagination
func (s *QueryService) ListTransfers(ctx context.Context, filter model.TransferFilter, pagination model.PaginationRequest) (*model.ListResponse[model.TransferResponse], error) {
	page, pageSize := s.normalizePagination(pagination)

	transfers, total, err := s.transferRepo.List(ctx, filter, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("list transfers: %w", err)
	}

	responses := make([]model.TransferResponse, len(transfers))
	for i, t := range transfers {
		responses[i] = t.ToResponse()
	}

	return &model.ListResponse[model.TransferResponse]{
		Items:      responses,
		Pagination: model.NewPaginationResponse(page, pageSize, total),
	}, nil
}

// GetAddressInfo retrieves aggregated information for an address
func (s *QueryService) GetAddressInfo(ctx context.Context, address, network string) (*model.AddressInfoResponse, error) {
	if network == "" {
		network = "ethereum"
	}

	// Try cache first
	if s.cache != nil {
		cacheKey := cache.AddressKey(address, network)
		var cached model.AddressInfoResponse
		if err := s.cache.Get(ctx, cacheKey, &cached); err == nil {
			s.logger.Debug("Cache hit for address info", zap.String("address", address))
			return &cached, nil
		}
	}

	// Query database
	info, err := s.transferRepo.GetAddressInfo(ctx, address, network)
	if err != nil {
		return nil, fmt.Errorf("get address info: %w", err)
	}
	if info == nil {
		return nil, nil
	}

	resp := info.ToResponse()

	// Cache the result
	if s.cache != nil {
		cacheKey := cache.AddressKey(address, network)
		if err := s.cache.Set(ctx, cacheKey, resp, s.config.Redis.CacheTTL.Address); err != nil {
			s.logger.Warn("Failed to cache address info", zap.Error(err))
		}
	}

	return &resp, nil
}

// GetAddressTransfers retrieves transfers for a specific address
func (s *QueryService) GetAddressTransfers(ctx context.Context, address string, filter model.TransferFilter, pagination model.PaginationRequest) (*model.ListResponse[model.TransferResponse], error) {
	page, pageSize := s.normalizePagination(pagination)

	if filter.Network == "" {
		filter.Network = "ethereum"
	}

	transfers, total, err := s.transferRepo.GetByAddress(ctx, address, filter, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("get address transfers: %w", err)
	}

	responses := make([]model.TransferResponse, len(transfers))
	for i, t := range transfers {
		responses[i] = t.ToResponse()
	}

	return &model.ListResponse[model.TransferResponse]{
		Items:      responses,
		Pagination: model.NewPaginationResponse(page, pageSize, total),
	}, nil
}

// GetAddressStats retrieves value statistics for an address
func (s *QueryService) GetAddressStats(ctx context.Context, address, network string) (*model.AddressStats, error) {
	if network == "" {
		network = "ethereum"
	}

	// Try cache first
	if s.cache != nil {
		cacheKey := cache.AddressStatsKey(address, network)
		var cached model.AddressStats
		if err := s.cache.Get(ctx, cacheKey, &cached); err == nil {
			s.logger.Debug("Cache hit for address stats", zap.String("address", address))
			return &cached, nil
		}
	}

	// Query database
	stats, err := s.transferRepo.GetAddressStats(ctx, address, network)
	if err != nil {
		return nil, fmt.Errorf("get address stats: %w", err)
	}

	// Cache the result
	if s.cache != nil {
		cacheKey := cache.AddressStatsKey(address, network)
		if err := s.cache.Set(ctx, cacheKey, stats, s.config.Redis.CacheTTL.Stats); err != nil {
			s.logger.Warn("Failed to cache address stats", zap.Error(err))
		}
	}

	return stats, nil
}

// normalizePagination ensures pagination values are within bounds
func (s *QueryService) normalizePagination(p model.PaginationRequest) (page, pageSize int) {
	page = p.Page
	pageSize = p.PageSize

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = s.config.API.DefaultPageSize
	}
	if pageSize > s.config.API.MaxPageSize {
		pageSize = s.config.API.MaxPageSize
	}

	return page, pageSize
}
