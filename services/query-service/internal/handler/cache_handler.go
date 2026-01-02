package handler

import (
	"net/http"
	"strings"

	"github.com/0ksks/chain-risk-platform/query-service/internal/model"
	"github.com/0ksks/chain-risk-platform/query-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CacheHandler handles HTTP requests for cache management
type CacheHandler struct {
	service *service.QueryService
	logger  *zap.Logger
}

// NewCacheHandler creates a new CacheHandler
func NewCacheHandler(svc *service.QueryService, logger *zap.Logger) *CacheHandler {
	return &CacheHandler{
		service: svc,
		logger:  logger,
	}
}

// RegisterRoutes implements RouteRegistrar interface
func (h *CacheHandler) RegisterRoutes() RouteGroup {
	return RouteGroup{
		Prefix: "/cache",
		Routes: []Route{
			{
				Method:  GET,
				Path:    "/stats",
				Handler: h.GetCacheStats,
			},
			{
				Method:  DELETE,
				Path:    "/addresses/:address",
				Handler: h.InvalidateAddressCache,
			},
		},
	}
}

// GetCacheStats godoc
// @Summary Get cache statistics
// @Description Get Redis cache statistics including hit rate, memory usage, and key count
// @Tags cache
// @Accept json
// @Produce json
// @Success 200 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/cache/stats [get]
func (h *CacheHandler) GetCacheStats(c *gin.Context) {
	if !h.service.IsCacheEnabled() {
		c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{
			"enabled": false,
			"message": "Cache is not enabled",
		}, nil))
		return
	}

	stats, err := h.service.GetCacheStats(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to get cache stats", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get cache stats"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{
		"enabled": true,
		"stats":   stats,
	}, nil))
}

// InvalidateAddressCache godoc
// @Summary Invalidate cache for an address
// @Description Remove all cached data for a specific blockchain address
// @Tags cache
// @Accept json
// @Produce json
// @Param address path string true "Blockchain Address"
// @Param network query string false "Network" default(ethereum)
// @Success 200 {object} model.APIResponse
// @Failure 400 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/cache/addresses/{address} [delete]
func (h *CacheHandler) InvalidateAddressCache(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	if !isValidAddress(address) {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ADDRESS", "Invalid blockchain address"))
		return
	}

	network := c.DefaultQuery("network", "ethereum")

	if !h.service.IsCacheEnabled() {
		c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{
			"message": "Cache is not enabled, nothing to invalidate",
		}, nil))
		return
	}

	if err := h.service.InvalidateAddressCache(c.Request.Context(), address, network); err != nil {
		h.logger.Error("Failed to invalidate address cache",
			zap.Error(err),
			zap.String("address", address),
			zap.String("network", network))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to invalidate cache"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(gin.H{
		"message": "Cache invalidated successfully",
		"address": address,
		"network": network,
	}, nil))
}
