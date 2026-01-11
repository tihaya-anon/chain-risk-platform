package handler

import (
	"net/http"
	"strconv"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"github.com/chain-risk-platform/alert-service/internal/repository"
	"github.com/chain-risk-platform/alert-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AlertRuleHandler handles alert rule endpoints
type AlertRuleHandler struct {
	service *service.AlertService
	logger  *zap.Logger
}

// NewAlertRuleHandler creates a new alert rule handler
func NewAlertRuleHandler(service *service.AlertService, logger *zap.Logger) *AlertRuleHandler {
	return &AlertRuleHandler{
		service: service,
		logger:  logger,
	}
}

// RegisterRoutes returns the route configuration
func (h *AlertRuleHandler) RegisterRoutes() RouteGroup {
	return RouteGroup{
		Prefix: "/alert-rules",
		Routes: []Route{
			{Method: GET, Path: "", Handler: h.List},
			{Method: GET, Path: "/:id", Handler: h.GetByID},
			{Method: POST, Path: "", Handler: h.Create},
			{Method: PUT, Path: "/:id", Handler: h.Update},
			{Method: DELETE, Path: "/:id", Handler: h.Delete},
			{Method: POST, Path: "/:id/enable", Handler: h.Enable},
			{Method: POST, Path: "/:id/disable", Handler: h.Disable},
		},
	}
}

// CreateAlertRuleRequest represents the create rule request
type CreateAlertRuleRequest struct {
	Name        string      `json:"name" binding:"required"`
	Description string      `json:"description"`
	RuleType    string      `json:"rule_type" binding:"required"`
	Conditions  model.JSONB `json:"conditions" binding:"required"`
	Severity    string      `json:"severity" binding:"required"`
	Enabled     *bool       `json:"enabled"`
}

// UpdateAlertRuleRequest represents the update rule request
type UpdateAlertRuleRequest struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	RuleType    string      `json:"rule_type"`
	Conditions  model.JSONB `json:"conditions"`
	Severity    string      `json:"severity"`
	Enabled     *bool       `json:"enabled"`
}

// List returns all alert rules with optional filters
func (h *AlertRuleHandler) List(c *gin.Context) {
	filters := repository.AlertRuleFilters{}

	// Parse enabled filter
	if e := c.Query("enabled"); e != "" {
		b := e == "true"
		filters.Enabled = &b
	}

	// Parse severity filter
	if s := c.Query("severity"); s != "" {
		if !isValidSeverity(s) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid severity value"})
			return
		}
		filters.Severity = &s
	}

	// Parse rule_type filter
	if rt := c.Query("rule_type"); rt != "" {
		if !isValidRuleType(rt) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule_type value"})
			return
		}
		filters.RuleType = &rt
	}

	rules, err := h.service.ListRules(c.Request.Context(), filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// GetByID returns a single rule
func (h *AlertRuleHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rule, err := h.service.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rule})
}

// Create creates a new rule
func (h *AlertRuleHandler) Create(c *gin.Context) {
	var req CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidRuleType(req.RuleType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule_type"})
		return
	}

	if !isValidSeverity(req.Severity) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid severity"})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	rule := &model.AlertRule{
		Name:        req.Name,
		Description: req.Description,
		RuleType:    req.RuleType,
		Conditions:  req.Conditions,
		Severity:    req.Severity,
		Enabled:     enabled,
	}

	if err := h.service.CreateRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rule})
}

// Update updates an existing rule
func (h *AlertRuleHandler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rule, err := h.service.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var req UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		rule.Name = req.Name
	}
	if req.Description != "" {
		rule.Description = req.Description
	}
	if req.RuleType != "" {
		if !isValidRuleType(req.RuleType) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule_type"})
			return
		}
		rule.RuleType = req.RuleType
	}
	if req.Conditions != nil {
		rule.Conditions = req.Conditions
	}
	if req.Severity != "" {
		if !isValidSeverity(req.Severity) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid severity"})
			return
		}
		rule.Severity = req.Severity
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}

	if err := h.service.UpdateRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rule})
}

// Delete deletes a rule
func (h *AlertRuleHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.service.DeleteRule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Enable enables a rule
func (h *AlertRuleHandler) Enable(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.service.SetRuleEnabled(c.Request.Context(), id, true); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "enabled"})
}

// Disable disables a rule
func (h *AlertRuleHandler) Disable(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.service.SetRuleEnabled(c.Request.Context(), id, false); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "disabled"})
}

func isValidRuleType(t string) bool {
	switch t {
	case model.RuleTypeRiskScore, model.RuleTypeTransactionValue,
		model.RuleTypeTagMatch, model.RuleTypeGraphPattern,
		model.RuleTypeVelocity, model.RuleTypeClusterRisk:
		return true
	default:
		return false
	}
}

func isValidSeverity(s string) bool {
	switch s {
	case model.SeverityLow, model.SeverityMedium,
		model.SeverityHigh, model.SeverityCritical:
		return true
	default:
		return false
	}
}
