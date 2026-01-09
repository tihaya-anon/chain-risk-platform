package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/repository"
	"github.com/chain-risk-platform/alert-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AlertHistoryHandler handles alert history endpoints
type AlertHistoryHandler struct {
	service *service.AlertService
	logger  *zap.Logger
}

// NewAlertHistoryHandler creates a new alert history handler
func NewAlertHistoryHandler(service *service.AlertService, logger *zap.Logger) *AlertHistoryHandler {
	return &AlertHistoryHandler{
		service: service,
		logger:  logger,
	}
}

// RegisterRoutes returns the route configuration
func (h *AlertHistoryHandler) RegisterRoutes() RouteGroup {
	return RouteGroup{
		Prefix: "/alerts",
		Routes: []Route{
			{Method: GET, Path: "", Handler: h.List},
			{Method: GET, Path: "/stats", Handler: h.GetStats},
			{Method: GET, Path: "/:id", Handler: h.GetByID},
			{Method: POST, Path: "/:id/acknowledge", Handler: h.Acknowledge},
		},
	}
}

// List returns alert history
func (h *AlertHistoryHandler) List(c *gin.Context) {
	filters := repository.AlertHistoryFilters{
		Limit: 100,
	}

	// Parse query params
	if v := c.Query("rule_id"); v != "" {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil {
			filters.RuleID = &id
		}
	}

	if v := c.Query("entity_type"); v != "" {
		filters.EntityType = &v
	}

	if v := c.Query("entity_id"); v != "" {
		filters.EntityID = &v
	}

	if v := c.Query("severity"); v != "" {
		filters.Severity = &v
	}

	if v := c.Query("status"); v != "" {
		filters.Status = &v
	}

	if v := c.Query("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.From = &t
		}
	}

	if v := c.Query("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.To = &t
		}
	}

	if v := c.Query("limit"); v != "" {
		if l, err := strconv.Atoi(v); err == nil && l > 0 && l <= 1000 {
			filters.Limit = l
		}
	}

	if v := c.Query("offset"); v != "" {
		if o, err := strconv.Atoi(v); err == nil && o >= 0 {
			filters.Offset = o
		}
	}

	alerts, err := h.service.ListAlerts(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": alerts})
}

// GetByID returns a single alert
func (h *AlertHistoryHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	alert, err := h.service.GetAlert(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": alert})
}

// GetStats returns alert statistics
func (h *AlertHistoryHandler) GetStats(c *gin.Context) {
	// Default to last 24 hours
	to := time.Now()
	from := to.Add(-24 * time.Hour)

	if v := c.Query("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			from = t
		}
	}

	if v := c.Query("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			to = t
		}
	}

	stats, err := h.service.GetAlertStats(c.Request.Context(), from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": stats,
		"period": gin.H{
			"from": from.Format(time.RFC3339),
			"to":   to.Format(time.RFC3339),
		},
	})
}

// AcknowledgeRequest represents acknowledge request
type AcknowledgeRequest struct {
	UserID string `json:"user_id"`
}

// Acknowledge acknowledges an alert
func (h *AlertHistoryHandler) Acknowledge(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req AcknowledgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Try to get user from header
		req.UserID = c.GetHeader("X-User-Id")
		if req.UserID == "" {
			req.UserID = "unknown"
		}
	}

	if err := h.service.AcknowledgeAlert(c.Request.Context(), id, req.UserID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "acknowledged"})
}
