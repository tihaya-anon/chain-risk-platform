package handler

import (
	"net/http"
	"strings"

	"github.com/0ksks/chain-risk-platform/query-service/internal/model"
	"github.com/0ksks/chain-risk-platform/query-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AddressHandler handles HTTP requests for address queries
type AddressHandler struct {
	service *service.QueryService
	logger  *zap.Logger
}

// NewAddressHandler creates a new AddressHandler
func NewAddressHandler(svc *service.QueryService, logger *zap.Logger) *AddressHandler {
	return &AddressHandler{
		service: svc,
		logger:  logger,
	}
}

// GetAddressInfo godoc
// @Summary Get address information
// @Description Get aggregated information for a blockchain address
// @Tags addresses
// @Accept json
// @Produce json
// @Param address path string true "Blockchain Address"
// @Param network query string false "Network" default(ethereum)
// @Success 200 {object} model.APIResponse{data=model.AddressInfoResponse}
// @Failure 400 {object} model.APIResponse
// @Failure 404 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/addresses/{address} [get]
func (h *AddressHandler) GetAddressInfo(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	if !isValidAddress(address) {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ADDRESS", "Invalid blockchain address"))
		return
	}

	network := c.DefaultQuery("network", "ethereum")

	info, err := h.service.GetAddressInfo(c.Request.Context(), address, network)
	if err != nil {
		h.logger.Error("Failed to get address info", zap.Error(err), zap.String("address", address))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get address info"))
		return
	}

	if info == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Address not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(info, nil))
}

// GetAddressTransfers godoc
// @Summary Get address transfers
// @Description Get paginated list of transfers for a specific address
// @Tags addresses
// @Accept json
// @Produce json
// @Param address path string true "Blockchain Address"
// @Param page query int false "Page number" default(1)
// @Param pageSize query int false "Page size" default(20)
// @Param network query string false "Network" default(ethereum)
// @Param transferType query string false "Filter by transfer type"
// @Param startTime query string false "Filter by start time (RFC3339)"
// @Param endTime query string false "Filter by end time (RFC3339)"
// @Success 200 {object} model.APIResponse{data=model.ListResponse[model.TransferResponse]}
// @Failure 400 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/addresses/{address}/transfers [get]
func (h *AddressHandler) GetAddressTransfers(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	if !isValidAddress(address) {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ADDRESS", "Invalid blockchain address"))
		return
	}

	var pagination model.PaginationRequest
	if err := c.ShouldBindQuery(&pagination); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", "Invalid pagination parameters"))
		return
	}

	var filter model.TransferFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", "Invalid filter parameters"))
		return
	}

	result, err := h.service.GetAddressTransfers(c.Request.Context(), address, filter, pagination)
	if err != nil {
		h.logger.Error("Failed to get address transfers", zap.Error(err), zap.String("address", address))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get address transfers"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(result.Items, result.Pagination))
}

// GetAddressStats godoc
// @Summary Get address statistics
// @Description Get value statistics for a blockchain address
// @Tags addresses
// @Accept json
// @Produce json
// @Param address path string true "Blockchain Address"
// @Param network query string false "Network" default(ethereum)
// @Success 200 {object} model.APIResponse{data=model.AddressStats}
// @Failure 400 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/addresses/{address}/stats [get]
func (h *AddressHandler) GetAddressStats(c *gin.Context) {
	address := strings.ToLower(c.Param("address"))
	if !isValidAddress(address) {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ADDRESS", "Invalid blockchain address"))
		return
	}

	network := c.DefaultQuery("network", "ethereum")

	stats, err := h.service.GetAddressStats(c.Request.Context(), address, network)
	if err != nil {
		h.logger.Error("Failed to get address stats", zap.Error(err), zap.String("address", address))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get address stats"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(stats, nil))
}

// isValidAddress checks if the address is a valid Ethereum address
func isValidAddress(address string) bool {
	if len(address) != 42 {
		return false
	}
	if !strings.HasPrefix(address, "0x") {
		return false
	}
	// Check if remaining characters are valid hex
	for _, c := range address[2:] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
