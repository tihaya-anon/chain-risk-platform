package handler

import (
	"net/http"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/chain-risk-platform/alert-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TestAlertHandler handles test alert endpoints
type TestAlertHandler struct {
	service *service.AlertService
	logger  *zap.Logger
}

// NewTestAlertHandler creates a new test alert handler
func NewTestAlertHandler(service *service.AlertService, logger *zap.Logger) *TestAlertHandler {
	return &TestAlertHandler{
		service: service,
		logger:  logger,
	}
}

// RegisterRoutes returns the route configuration
func (h *TestAlertHandler) RegisterRoutes() RouteGroup {
	return RouteGroup{
		Prefix: "/test",
		Routes: []Route{
			{Method: POST, Path: "/alert", Handler: h.SendTestAlert},
		},
	}
}

// TestAlertRequest represents test alert request
type TestAlertRequest struct {
	ChannelType   string      `json:"channel_type" binding:"required"`
	ChannelConfig model.JSONB `json:"channel_config" binding:"required"`
	Message       string      `json:"message"`
}

// SendTestAlert sends a test notification
func (h *TestAlertHandler) SendTestAlert(c *gin.Context) {
	var req TestAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidChannelType(req.ChannelType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel_type"})
		return
	}

	message := req.Message
	if message == "" {
		message = "This is a test alert from Chain Risk Platform"
	}

	if err := h.service.SendTestAlert(c.Request.Context(), req.ChannelType, req.ChannelConfig, message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "test alert sent"})
}
