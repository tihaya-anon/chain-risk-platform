// Package validation provides input validation utilities
package validation

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// Common validation errors
var (
	ErrInvalidAddress   = errors.New("invalid ethereum address format")
	ErrAddressRequired  = errors.New("address is required")
	ErrSQLInjection     = errors.New("potential SQL injection detected")
	ErrInvalidSeverity  = errors.New("invalid severity level")
	ErrInvalidRuleType  = errors.New("invalid rule type")
)

// Regex patterns
var (
	ethAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)
	uuidRegex       = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

	sqlInjectionPatterns = []string{
		"--", ";--", "/*", "*/", "@@",
		"alter ", "create ", "delete ", "drop ",
		"exec(", "execute(", "insert ", "select ",
		"update ", "union ", "xp_",
	}

	validSeverities = map[string]bool{
		"low": true, "medium": true, "high": true, "critical": true,
	}

	validRuleTypes = map[string]bool{
		"risk_score": true, "transaction_value": true, "tag_match": true, "cluster_risk": true,
	}
)

// Config holds validation configuration
type Config struct {
	MaxBodySize  int64
	MaxURLLength int
}

// DefaultConfig returns default validation config
func DefaultConfig() Config {
	return Config{
		MaxBodySize:  512 * 1024, // 512KB
		MaxURLLength: 2048,
	}
}

// ValidateEthAddress validates an Ethereum address
func ValidateEthAddress(addr string) error {
	if addr == "" {
		return ErrAddressRequired
	}
	if !ethAddressRegex.MatchString(addr) {
		return ErrInvalidAddress
	}
	return nil
}

// IsValidEthAddress returns true if the address is valid
func IsValidEthAddress(addr string) bool {
	return ethAddressRegex.MatchString(addr)
}

// IsValidUUID returns true if the string is a valid UUID
func IsValidUUID(id string) bool {
	return uuidRegex.MatchString(id)
}

// ValidateSeverity validates alert severity
func ValidateSeverity(severity string) error {
	if !validSeverities[strings.ToLower(severity)] {
		return ErrInvalidSeverity
	}
	return nil
}

// IsValidSeverity returns true if severity is valid
func IsValidSeverity(severity string) bool {
	return validSeverities[strings.ToLower(severity)]
}

// ValidateRuleType validates alert rule type
func ValidateRuleType(ruleType string) error {
	if !validRuleTypes[ruleType] {
		return ErrInvalidRuleType
	}
	return nil
}

// IsValidRuleType returns true if rule type is valid
func IsValidRuleType(ruleType string) bool {
	return validRuleTypes[ruleType]
}

// CheckSQLInjection checks for SQL injection patterns
func CheckSQLInjection(input string) error {
	lower := strings.ToLower(input)
	for _, pattern := range sqlInjectionPatterns {
		if strings.Contains(lower, pattern) {
			return ErrSQLInjection
		}
	}
	return nil
}

// SanitizeString removes potentially dangerous characters
func SanitizeString(input string) string {
	input = strings.ReplaceAll(input, "\x00", "")
	return strings.TrimSpace(input)
}

// RequestSizeMiddleware limits request body and URL size
func RequestSizeMiddleware(cfg Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check URL length
		if len(c.Request.URL.String()) > cfg.MaxURLLength {
			c.AbortWithStatusJSON(http.StatusRequestURITooLong, gin.H{
				"error":   "url_too_long",
				"message": "Request URL exceeds maximum allowed length",
			})
			return
		}

		// Limit body size
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, cfg.MaxBodySize)
		c.Next()
	}
}

// ValidationMiddleware combines common validation checks
func ValidationMiddleware(cfg Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check URL length
		if len(c.Request.URL.String()) > cfg.MaxURLLength {
			c.AbortWithStatusJSON(http.StatusRequestURITooLong, gin.H{
				"error":   "url_too_long",
				"message": "Request URL exceeds maximum allowed length",
			})
			return
		}

		// Check content length
		if c.Request.ContentLength > cfg.MaxBodySize {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":   "body_too_large",
				"message": "Request body exceeds maximum allowed size",
			})
			return
		}

		c.Next()
	}
}

// AlertRuleValidator validates alert rule requests
type AlertRuleValidator struct{}

// NewAlertRuleValidator creates a new alert rule validator
func NewAlertRuleValidator() *AlertRuleValidator {
	return &AlertRuleValidator{}
}

// ValidateCreateRule validates rule creation request
func (v *AlertRuleValidator) ValidateCreateRule() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Let the handler do detailed validation
		// This middleware does basic SQL injection check on query params
		for _, values := range c.Request.URL.Query() {
			for _, val := range values {
				if err := CheckSQLInjection(val); err != nil {
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
						"error":   "validation_error",
						"message": "Invalid characters in request",
					})
					return
				}
			}
		}
		c.Next()
	}
}
