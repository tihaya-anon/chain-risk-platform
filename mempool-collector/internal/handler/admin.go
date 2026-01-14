package handler

import (
	"net/http"

	"github.com/chain-risk-platform/mempool-collector/internal/collector"
	"github.com/gin-gonic/gin"
)

// AdminHandler provides admin endpoints
type AdminHandler struct {
	collector *collector.Collector
}

// NewAdminHandler creates admin handler
func NewAdminHandler(c *collector.Collector) *AdminHandler {
	return &AdminHandler{collector: c}
}

// Health returns service health
func (h *AdminHandler) Health(c *gin.Context) {
	status := "healthy"
	if !h.collector.IsConnected() {
		status = "degraded"
	}
	c.JSON(http.StatusOK, gin.H{
		"status":    status,
		"connected": h.collector.IsConnected(),
	})
}

// Ready returns readiness status
func (h *AdminHandler) Ready(c *gin.Context) {
	if !h.collector.IsConnected() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"ready": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ready": true})
}

// RegisterRoutes registers admin routes
func (h *AdminHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", h.Health)
	r.GET("/ready", h.Ready)
}
