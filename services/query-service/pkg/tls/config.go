// Package tls provides TLS/mTLS configuration utilities for Go services.
package tls

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
)

// Config holds TLS configuration parameters.
type Config struct {
	Enabled    bool   `mapstructure:"enabled"`
	CertPath   string `mapstructure:"cert_path"`
	KeyPath    string `mapstructure:"key_path"`
	CAPath     string `mapstructure:"ca_path"`
	MTLSMode   string `mapstructure:"mtls_mode"` // "disabled", "optional", "required"
	MinVersion string `mapstructure:"min_version"`
}

// DefaultConfig returns a default TLS configuration.
func DefaultConfig() *Config {
	return &Config{
		Enabled:    false,
		CertPath:   "/certs/cert.pem",
		KeyPath:    "/certs/key.pem",
		CAPath:     "/certs/ca.pem",
		MTLSMode:   "required",
		MinVersion: "1.2",
	}
}

// LoadFromEnv loads TLS configuration from environment variables.
func LoadFromEnv() *Config {
	cfg := DefaultConfig()

	if v := os.Getenv("TLS_ENABLED"); v == "true" {
		cfg.Enabled = true
	}
	if v := os.Getenv("TLS_CERT_PATH"); v != "" {
		cfg.CertPath = v
	}
	if v := os.Getenv("TLS_KEY_PATH"); v != "" {
		cfg.KeyPath = v
	}
	if v := os.Getenv("TLS_CA_PATH"); v != "" {
		cfg.CAPath = v
	}
	if v := os.Getenv("TLS_MTLS_MODE"); v != "" {
		cfg.MTLSMode = v
	}
	if v := os.Getenv("TLS_MIN_VERSION"); v != "" {
		cfg.MinVersion = v
	}

	return cfg
}

// NewServerTLSConfig creates a TLS configuration for server use.
func NewServerTLSConfig(cfg *Config) (*tls.Config, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	// Load server certificate
	cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("load server certificate: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   parseMinVersion(cfg.MinVersion),
		CipherSuites: preferredCipherSuites(),
	}

	// Configure client authentication
	if cfg.MTLSMode != "disabled" {
		caPool, err := loadCAPool(cfg.CAPath)
		if err != nil {
			return nil, fmt.Errorf("load CA pool: %w", err)
		}
		tlsConfig.ClientCAs = caPool

		switch cfg.MTLSMode {
		case "required":
			tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
		case "optional":
			tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
		default:
			tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
		}
	}

	return tlsConfig, nil
}

// NewClientTLSConfig creates a TLS configuration for client use.
func NewClientTLSConfig(cfg *Config) (*tls.Config, error) {
	if !cfg.Enabled {
		return nil, nil
	}

	tlsConfig := &tls.Config{
		MinVersion:   parseMinVersion(cfg.MinVersion),
		CipherSuites: preferredCipherSuites(),
	}

	// Load CA pool for server verification
	caPool, err := loadCAPool(cfg.CAPath)
	if err != nil {
		return nil, fmt.Errorf("load CA pool: %w", err)
	}
	tlsConfig.RootCAs = caPool

	// Load client certificate for mTLS
	if cfg.CertPath != "" && cfg.KeyPath != "" {
		cert, err := tls.LoadX509KeyPair(cfg.CertPath, cfg.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("load client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	return tlsConfig, nil
}

func loadCAPool(caPath string) (*x509.CertPool, error) {
	caCert, err := os.ReadFile(caPath)
	if err != nil {
		return nil, fmt.Errorf("read CA certificate: %w", err)
	}

	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to parse CA certificate")
	}

	return caPool, nil
}

func parseMinVersion(version string) uint16 {
	switch version {
	case "1.0":
		return tls.VersionTLS10
	case "1.1":
		return tls.VersionTLS11
	case "1.2":
		return tls.VersionTLS12
	case "1.3":
		return tls.VersionTLS13
	default:
		return tls.VersionTLS12
	}
}

func preferredCipherSuites() []uint16 {
	return []uint16{
		tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	}
}
