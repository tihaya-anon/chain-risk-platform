package handler

import (
	"net/http"
	"strconv"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/chain-risk-platform/alert-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SubscriptionHandler handles subscription endpoints
type SubscriptionHandler struct {
	service *service.AlertService
	logger  *zap.Logger
}

// NewSubscriptionHandler creates a new subscription handler
func NewSubscriptionHandler(service *service.AlertService, logger *zap.Logger) *SubscriptionHandler {
	return &SubscriptionHandler{
		service: service,
		logger:  logger,
	}
}

// RegisterRoutes returns the route configuration
func (h *SubscriptionHandler) RegisterRoutes() RouteGroup {
	return RouteGroup{
		Prefix: "/subscriptions",
		Routes: []Route{
			{Method: GET, Path: "", Handler: h.List},
			{Method: GET, Path: "/:id", Handler: h.GetByID},
			{Method: POST, Path: "", Handler: h.Create},
			{Method: DELETE, Path: "/:id", Handler: h.Delete},
		},
	}
}

// CreateSubscriptionRequest represents create subscription request
type CreateSubscriptionRequest struct {
	UserID        string      `json:"user_id" binding:"required"`
	RuleID        *int64      `json:"rule_id"`
	ChannelType   string      `json:"channel_type" binding:"required"`
	ChannelConfig model.JSONB `json:"channel_config" binding:"required"`
	Enabled       *bool       `json:"enabled"`
}

// List returns subscriptions for a user
func (h *SubscriptionHandler) List(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
	}

	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id required"})
		return
	}

	subs, err := h.service.ListSubscriptionsByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": subs})
}

// GetByID returns a single subscription
func (h *SubscriptionHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	sub, err := h.service.GetSubscription(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sub})
}

// Create creates a new subscription
func (h *SubscriptionHandler) Create(c *gin.Context) {
	var req CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate channel type
	if !isValidChannelType(req.ChannelType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid channel_type"})
		return
	}

	// Validate channel config
	if err := validateChannelConfig(req.ChannelType, req.ChannelConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	sub := &model.AlertSubscription{
		UserID:        req.UserID,
		RuleID:        safeDerefInt64(req.RuleID),
		ChannelType:   req.ChannelType,
		ChannelConfig: req.ChannelConfig,
		Enabled:       enabled,
	}

	if err := h.service.CreateSubscription(c.Request.Context(), sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": sub})
}

// Delete deletes a subscription
func (h *SubscriptionHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.service.DeleteSubscription(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func isValidChannelType(t string) bool {
	switch t {
	case model.ChannelTypeEmail, model.ChannelTypeWebhook,
		model.ChannelTypeSlack, model.ChannelTypeTelegram:
		return true
	default:
		return false
	}
}

func validateChannelConfig(channelType string, config model.JSONB) error {
	switch channelType {
	case model.ChannelTypeEmail:
		if _, ok := config["email"].(string); !ok {
			return &configError{"email address required"}
		}
	case model.ChannelTypeWebhook:
		if _, ok := config["url"].(string); !ok {
			return &configError{"webhook url required"}
		}
	case model.ChannelTypeSlack:
		if _, ok := config["webhook_url"].(string); !ok {
			return &configError{"slack webhook_url required"}
		}
	}
	return nil
}

type configError struct {
	msg string
}

func (e *configError) Error() string {
	return e.msg
}

func safeDerefInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}
