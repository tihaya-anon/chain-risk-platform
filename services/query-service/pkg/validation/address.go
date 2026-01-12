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
	ErrInvalidAddress     = errors.New("invalid ethereum address format")
	ErrAddressRequired    = errors.New("address is required")
	ErrSQLInjection       = errors.New("potential SQL injection detected")
	ErrRequestTooLarge    = errors.New("request body too large")
	ErrURLTooLong         = errors.New("URL too long")
	ErrInvalidInput       = errors.New("invalid input")
)

// Regex patterns
var (
	ethAddressRegex  = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)
	sqlInjectionPatterns = []string{
		"--",
		";--",
		";",
		"/*",
		"*/",
		"@@",
		"char(",
		"nchar(",
		"varchar(",
		"nvarchar(",
		"alter ",
		"begin ",
		"cast(",
		"create ",
		"cursor ",
		"declare ",
		"delete ",
		"drop ",
		"exec(",
		"exec ",
		"execute(",
		"execute ",
		"fetch ",
		"insert ",
		"kill ",
		"select ",
		"sysobjects",
		"syscolumns",
		"table ",
		"update ",
		"union ",
		"xp_",
	}
)

// Config holds validation configuration
type Config struct {
	MaxBodySize   int64 // Max request body size in bytes
	MaxURLLength  int   // Max URL length
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
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")
	// Trim whitespace
	input = strings.TrimSpace(input)
	return input
}

// ValidationResult holds validation result
type ValidationResult struct {
	Valid  bool
	Errors []string
}

// AddressValidator validates address-related requests
type AddressValidator struct {
	config Config
}

// NewAddressValidator creates a new address validator
func NewAddressValidator() *AddressValidator {
	return &AddressValidator{config: DefaultConfig()}
}

// NewAddressValidatorWithConfig creates a validator with custom config
func NewAddressValidatorWithConfig(cfg Config) *AddressValidator {
	return &AddressValidator{config: cfg}
}

// ValidateAddressParam validates an address path parameter
func (v *AddressValidator) ValidateAddressParam() gin.HandlerFunc {
	return func(c *gin.Context) {
		addr := c.Param("address")
		if addr == "" {
			addr = c.Query("address")
		}

		if addr == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":   "validation_error",
				"message": "address parameter is required",
			})
			return
		}

		// Check for SQL injection first
		if err := CheckSQLInjection(addr); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":   "validation_error",
				"message": "invalid characters in address",
			})
			return
		}

		// Validate address format
		if err := ValidateEthAddress(addr); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error":   "validation_error",
				"message": err.Error(),
				"details": "address must be a valid Ethereum address (0x followed by 40 hex characters)",
			})
			return
		}

		c.Next()
	}
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

// InputSanitizationMiddleware sanitizes common input fields
func InputSanitizationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Sanitize query parameters containing addresses
		for key, values := range c.Request.URL.Query() {
			if strings.Contains(strings.ToLower(key), "address") {
				for i, v := range values {
					values[i] = SanitizeString(v)
				}
			}
		}
		c.Next()
	}
}

// ValidationMiddleware combines validation checks
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

		// Limit body size
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
