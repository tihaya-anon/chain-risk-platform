package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/0ksks/chain-risk-platform/query-service/internal/model"
	"github.com/0ksks/chain-risk-platform/query-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TransferHandler handles HTTP requests for transfers
type TransferHandler struct {
	service *service.QueryService
	logger  *zap.Logger
}

// NewTransferHandler creates a new TransferHandler
func NewTransferHandler(svc *service.QueryService, logger *zap.Logger) *TransferHandler {
	return &TransferHandler{
		service: svc,
		logger:  logger,
	}
}

// GetTransfer godoc
// @Summary Get transfer by ID
// @Description Get a single transfer by its ID
// @Tags transfers
// @Accept json
// @Produce json
// @Param id path int true "Transfer ID"
// @Success 200 {object} model.APIResponse{data=model.TransferResponse}
// @Failure 400 {object} model.APIResponse
// @Failure 404 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/transfers/{id} [get]
func (h *TransferHandler) GetTransfer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ID", "Invalid transfer ID"))
		return
	}

	transfer, err := h.service.GetTransfer(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to get transfer", zap.Error(err), zap.Int64("id", id))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get transfer"))
		return
	}

	if transfer == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "Transfer not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(transfer, nil))
}

// GetTransfersByTxHash godoc
// @Summary Get transfers by transaction hash
// @Description Get all transfers for a specific transaction
// @Tags transfers
// @Accept json
// @Produce json
// @Param txHash path string true "Transaction Hash"
// @Success 200 {object} model.APIResponse{data=[]model.TransferResponse}
// @Failure 400 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/transfers/tx/{txHash} [get]
func (h *TransferHandler) GetTransfersByTxHash(c *gin.Context) {
	txHash := c.Param("txHash")
	if txHash == "" || !strings.HasPrefix(txHash, "0x") {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_TX_HASH", "Invalid transaction hash"))
		return
	}

	transfers, err := h.service.GetTransfersByTxHash(c.Request.Context(), txHash)
	if err != nil {
		h.logger.Error("Failed to get transfers by tx hash", zap.Error(err), zap.String("txHash", txHash))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to get transfers"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(transfers, nil))
}

// ListTransfers godoc
// @Summary List transfers
// @Description Get a paginated list of transfers with optional filters
// @Tags transfers
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param pageSize query int false "Page size" default(20)
// @Param address query string false "Filter by address (from or to)"
// @Param fromAddress query string false "Filter by sender address"
// @Param toAddress query string false "Filter by receiver address"
// @Param tokenAddress query string false "Filter by token contract address"
// @Param transferType query string false "Filter by transfer type (native, erc20)"
// @Param network query string false "Filter by network" default(ethereum)
// @Param startTime query string false "Filter by start time (RFC3339)"
// @Param endTime query string false "Filter by end time (RFC3339)"
// @Success 200 {object} model.APIResponse
// @Failure 500 {object} model.APIResponse
// @Router /api/v1/transfers [get]
func (h *TransferHandler) ListTransfers(c *gin.Context) {
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

	result, err := h.service.ListTransfers(c.Request.Context(), filter, pagination)
	if err != nil {
		h.logger.Error("Failed to list transfers", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL_ERROR", "Failed to list transfers"))
		return
	}

	c.JSON(http.StatusOK, model.NewSuccessResponse(result.Items, result.Pagination))
}
