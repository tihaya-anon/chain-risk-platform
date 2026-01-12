package tls

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireMTLS is a Gin middleware that enforces mTLS client certificate.
func RequireMTLS() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if not TLS
		if c.Request.TLS == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "TLS required",
			})
			return
		}

		// Check for client certificate
		if len(c.Request.TLS.PeerCertificates) == 0 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Client certificate required",
			})
			return
		}

		// Add certificate info to context
		cert := c.Request.TLS.PeerCertificates[0]
		c.Set("client_cn", cert.Subject.CommonName)
		c.Set("client_cert", cert)

		c.Next()
	}
}

// ExtractClientCN extracts the Common Name from client certificate.
func ExtractClientCN(c *gin.Context) string {
	cn, exists := c.Get("client_cn")
	if !exists {
		return ""
	}
	return cn.(string)
}

// HealthBypass allows health check endpoint to bypass mTLS.
func HealthBypass(paths ...string) gin.HandlerFunc {
	pathSet := make(map[string]bool)
	for _, p := range paths {
		pathSet[p] = true
	}

	return func(c *gin.Context) {
		if pathSet[c.Request.URL.Path] {
			c.Next()
			return
		}

		RequireMTLS()(c)
	}
}
