package handler

import (
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/nacos"
	"go.uber.org/zap"
)

// AdminHandler handles admin API requests
type AdminHandler struct {
	nacosClient  *nacos.Client
	logger       *zap.Logger
	
	// Manual control flags
	manualPaused atomic.Bool
	
	// Service status
	startTime    time.Time
	
	// Callbacks for service control
	getLastBlock func() uint64
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(nacosClient *nacos.Client, logger *zap.Logger) *AdminHandler {
	return &AdminHandler{
		nacosClient: nacosClient,
		logger:      logger,
		startTime:   time.Now(),
	}
}

// SetBlockGetter sets the callback to get last processed block
func (h *AdminHandler) SetBlockGetter(getter func() uint64) {
	h.getLastBlock = getter
}

// RegisterRoutes registers admin routes
func (h *AdminHandler) RegisterRoutes(r *gin.Engine) {
	admin := r.Group("/admin")
	{
		admin.GET("/status", h.GetStatus)
		admin.GET("/config", h.GetConfig)
		admin.POST("/pause", h.Pause)
		admin.POST("/resume", h.Resume)
	}
}

// StatusResponse represents the service status
type StatusResponse struct {
	Service         string                 `json:"service"`
	Status          string                 `json:"status"`
	EffectiveStatus string                 `json:"effectiveStatus"`
	NacosConfig     map[string]interface{} `json:"nacosConfig"`
	ManualControl   map[string]interface{} `json:"manualControl"`
	Runtime         map[string]interface{} `json:"runtime"`
	Timestamp       int64                  `json:"timestamp"`
}

// GetStatus returns the current service status
func (h *AdminHandler) GetStatus(c *gin.Context) {
	config := h.nacosClient.GetConfig()
	
	// Determine effective status
	effectiveStatus := "running"
	if !config.Pipeline.Enabled || !config.Pipeline.Ingestion.Enabled {
		effectiveStatus = "disabled_by_nacos"
	} else if h.manualPaused.Load() {
		effectiveStatus = "paused_manually"
	}
	
	var lastBlock uint64
	if h.getLastBlock != nil {
		lastBlock = h.getLastBlock()
	}
	
	response := StatusResponse{
		Service:         "data-ingestion",
		Status:          "healthy",
		EffectiveStatus: effectiveStatus,
		NacosConfig: map[string]interface{}{
			"pipelineEnabled":  config.Pipeline.Enabled,
			"ingestionEnabled": config.Pipeline.Ingestion.Enabled,
			"batchSize":        config.Pipeline.Ingestion.Polling.BatchSize,
			"intervalMs":       config.Pipeline.Ingestion.Polling.IntervalMs,
			"network":          config.Pipeline.Ingestion.Network,
		},
		ManualControl: map[string]interface{}{
			"paused": h.manualPaused.Load(),
		},
		Runtime: map[string]interface{}{
			"uptime":         time.Since(h.startTime).String(),
			"lastBlock":      lastBlock,
		},
		Timestamp: time.Now().UnixMilli(),
	}
	
	c.JSON(http.StatusOK, response)
}

// GetConfig returns the current Nacos configuration
func (h *AdminHandler) GetConfig(c *gin.Context) {
	config := h.nacosClient.GetConfig()
	c.JSON(http.StatusOK, config)
}

// Pause pauses the ingestion service
func (h *AdminHandler) Pause(c *gin.Context) {
	h.manualPaused.Store(true)
	h.logger.Info("Ingestion paused via Admin API")
	
	c.JSON(http.StatusOK, gin.H{
		"action":    "pause",
		"status":    "paused",
		"message":   "Data ingestion has been paused manually",
		"timestamp": time.Now().UnixMilli(),
	})
}

// Resume resumes the ingestion service
func (h *AdminHandler) Resume(c *gin.Context) {
	h.manualPaused.Store(false)
	h.logger.Info("Ingestion resumed via Admin API")
	
	c.JSON(http.StatusOK, gin.H{
		"action":    "resume",
		"status":    "running",
		"message":   "Data ingestion has been resumed",
		"timestamp": time.Now().UnixMilli(),
	})
}

// IsPaused returns whether the service is manually paused
func (h *AdminHandler) IsPaused() bool {
	return h.manualPaused.Load()
}

// ShouldRun checks if the service should run based on Nacos config and manual control
func (h *AdminHandler) ShouldRun() bool {
	// Check Nacos config
	if !h.nacosClient.IsIngestionEnabled() {
		return false
	}
	// Check manual pause
	if h.manualPaused.Load() {
		return false
	}
	return true
}
