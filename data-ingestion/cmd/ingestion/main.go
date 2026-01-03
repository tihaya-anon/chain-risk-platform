package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/fetcher"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/handler"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/nacos"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	configPath = flag.String("config", "configs/config.yaml", "path to config file")
	version    = "dev"
	buildTime  = "unknown"
)

func main() {
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	logger, err := initLogger(cfg.Logging)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Starting data ingestion service",
		zap.String("version", version),
		zap.String("buildTime", buildTime),
		zap.String("network", cfg.Blockchain.Network))

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Initialize Nacos client (optional - if NACOS_SERVER is set)
	var nacosClient *nacos.Client
	var adminHandler *handler.AdminHandler

	if nacosServer := os.Getenv("NACOS_SERVER"); nacosServer != "" {
		nacosClient, err = initNacosClient(logger)
		if err != nil {
			logger.Warn("Failed to initialize Nacos client, running without Nacos", zap.Error(err))
		} else {
			logger.Info("Nacos client initialized", zap.String("server", nacosServer))

			// Register service with Nacos
			if err := nacosClient.RegisterService(map[string]string{
				"version": version,
				"network": cfg.Blockchain.Network,
			}); err != nil {
				logger.Warn("Failed to register service with Nacos", zap.Error(err))
			}

			// Create admin handler
			adminHandler = handler.NewAdminHandler(nacosClient, logger)
		}
	} else {
		logger.Info("NACOS_SERVER not set, running without Nacos integration")
	}

	// Initialize fetcher based on network
	var blockFetcher fetcher.Fetcher
	switch cfg.Blockchain.Network {
	case "ethereum":
		blockFetcher = fetcher.NewEtherscanFetcher(
			cfg.Blockchain.Network,
			cfg.Blockchain.Etherscan.BaseURL,
			cfg.Blockchain.Etherscan.APIKey,
			cfg.Blockchain.Etherscan.RateLimit,
			logger,
		)
	case "bsc":
		blockFetcher = fetcher.NewEtherscanFetcher(
			cfg.Blockchain.Network,
			cfg.Blockchain.BSCScan.BaseURL,
			cfg.Blockchain.BSCScan.APIKey,
			cfg.Blockchain.BSCScan.RateLimit,
			logger,
		)
	default:
		logger.Fatal("Unsupported network", zap.String("network", cfg.Blockchain.Network))
	}
	defer blockFetcher.Close()

	// Initialize producer (Kafka in production, Noop in test mode)
	// The actual implementation is selected at compile time via build tags
	msgProducer, err := producer.NewProducer(&cfg.Kafka, logger)
	if err != nil {
		logger.Fatal("Failed to create producer", zap.Error(err))
	}
	defer msgProducer.Close()

	// Initialize ingestion service
	ingestionService := service.NewService(cfg, blockFetcher, msgProducer, logger)

	// Set Nacos client if available
	if nacosClient != nil {
		ingestionService.SetNacosClient(nacosClient)

		// Set block getter for admin handler
		if adminHandler != nil {
			adminHandler.SetBlockGetter(ingestionService.GetLastProcessedBlock)
		}
	}

	// Start HTTP server (metrics + admin API)
	go startHTTPServer(cfg.Metrics, adminHandler, logger)

	// Start ingestion in goroutine
	errChan := make(chan error, 1)
	go func() {
		errChan <- ingestionService.Start(ctx)
	}()

	// Wait for shutdown signal or error
	select {
	case sig := <-sigChan:
		logger.Info("Received shutdown signal", zap.String("signal", sig.String()))
		cancel()

		// Cleanup Nacos
		if nacosClient != nil {
			nacosClient.Close()
		}

		// Give some time for graceful shutdown
		time.Sleep(2 * time.Second)
	case err := <-errChan:
		if err != nil && err != context.Canceled {
			logger.Error("Ingestion service error", zap.Error(err))
		}
	}

	logger.Info("Data ingestion service stopped")
}

func initLogger(cfg config.LoggingConfig) (*zap.Logger, error) {
	var level zapcore.Level
	if err := level.UnmarshalText([]byte(cfg.Level)); err != nil {
		level = zapcore.InfoLevel
	}

	var zapCfg zap.Config
	if cfg.Format == "console" {
		zapCfg = zap.NewDevelopmentConfig()
	} else {
		zapCfg = zap.NewProductionConfig()
	}

	zapCfg.Level = zap.NewAtomicLevelAt(level)
	if len(cfg.OutputPaths) > 0 {
		zapCfg.OutputPaths = cfg.OutputPaths
	}

	return zapCfg.Build()
}

func initNacosClient(logger *zap.Logger) (*nacos.Client, error) {
	// Parse Nacos server address
	nacosServer := os.Getenv("NACOS_SERVER")
	if nacosServer == "" {
		return nil, fmt.Errorf("NACOS_SERVER not set")
	}

	// Parse host:port
	var serverAddr string
	var serverPort uint64 = 18848

	parts := strings.Split(nacosServer, ":")
	serverAddr = parts[0]
	if len(parts) > 1 {
		if p, err := strconv.ParseUint(parts[1], 10, 64); err == nil {
			serverPort = p
		}
	}

	// Get service IP (for registration)
	serviceIP := os.Getenv("SERVICE_IP")
	if serviceIP == "" {
		serviceIP = "127.0.0.1"
	}

	// Get service port
	servicePort := uint64(8083) // default port for data-ingestion
	if p := os.Getenv("SERVICE_PORT"); p != "" {
		if parsed, err := strconv.ParseUint(p, 10, 64); err == nil {
			servicePort = parsed
		}
	}

	nacosCfg := &nacos.Config{
		ServerAddr:  serverAddr,
		ServerPort:  serverPort,
		NamespaceID: os.Getenv("NACOS_NAMESPACE"),
		Username:    os.Getenv("NACOS_USERNAME"),
		Password:    os.Getenv("NACOS_PASSWORD"),
		ServiceName: "data-ingestion",
		ServiceIP:   serviceIP,
		ServicePort: servicePort,
	}

	return nacos.NewClient(nacosCfg, logger)
}

func startHTTPServer(metricsCfg config.MetricsConfig, adminHandler *handler.AdminHandler, logger *zap.Logger) {
	// Use Gin for HTTP server
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	// Metrics endpoint
	if metricsCfg.Enabled {
		r.GET(metricsCfg.Path, gin.WrapH(promhttp.Handler()))
	}

	// Admin routes (if Nacos is enabled)
	if adminHandler != nil {
		adminHandler.RegisterRoutes(r)
		logger.Info("Admin API enabled at /admin/*")
	}

	// Determine port
	port := metricsCfg.Port
	if port == 0 {
		port = 8083
	}

	addr := fmt.Sprintf(":%d", port)
	logger.Info("Starting HTTP server", zap.String("addr", addr))

	if err := r.Run(addr); err != nil && err != http.ErrServerClosed {
		logger.Error("HTTP server error", zap.Error(err))
	}
}
