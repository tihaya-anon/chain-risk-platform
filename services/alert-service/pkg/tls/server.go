package tls

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Server wraps http.Server with TLS configuration.
type Server struct {
	*http.Server
	tlsConfig *tls.Config
	listener  net.Listener
}

// NewServer creates a new TLS-enabled HTTP server.
func NewServer(addr string, handler http.Handler, tlsCfg *Config) (*Server, error) {
	var tlsConfig *tls.Config
	var err error

	if tlsCfg != nil && tlsCfg.Enabled {
		tlsConfig, err = NewServerTLSConfig(tlsCfg)
		if err != nil {
			return nil, fmt.Errorf("create TLS config: %w", err)
		}
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		TLSConfig:         tlsConfig,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
	}

	return &Server{
		Server:    srv,
		tlsConfig: tlsConfig,
	}, nil
}

// ListenAndServe starts the server with or without TLS.
func (s *Server) ListenAndServe() error {
	ln, err := net.Listen("tcp", s.Addr)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	s.listener = ln

	if s.tlsConfig != nil {
		s.listener = tls.NewListener(ln, s.tlsConfig)
		return s.Serve(s.listener)
	}

	return s.Serve(ln)
}

// ListenAddr returns the actual listening address.
func (s *Server) ListenAddr() string {
	if s.listener != nil {
		return s.listener.Addr().String()
	}
	return s.Addr
}

// IsTLSEnabled returns whether TLS is enabled.
func (s *Server) IsTLSEnabled() bool {
	return s.tlsConfig != nil
}
