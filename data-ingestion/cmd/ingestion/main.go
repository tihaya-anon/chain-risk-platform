package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/yourusername/chain-risk-platform/data-ingestion/internal/client"
	"github.com/yourusername/chain-risk-platform/data-ingestion/internal/config"
	"github.com/yourusername/chain-risk-platform/data-ingestion/internal/producer"
	"github.com/yourusername/chain-risk-platform/data-ingestion/internal/service"
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

	// Initialize blockchain client
	var blockchainClient client.BlockchainClient
	switch cfg.Blockchain.Network {
	case "ethereum":
		blockchainClient, err = client.NewEtherscanClient(
			cfg.Blockchain.Network,
			cfg.Blockchain.Etherscan.BaseURL,
			cfg.Blockchain.Etherscan.APIKey,
			cfg.Blockchain.Etherscan.RateLimit,
		)
	case "bsc":
		blockchainClient, err = client.NewEtherscanClient(
			cfg.Blockchain.Network,
			cfg.Blockchain.BSCScan.BaseURL,
			cfg.Blockchain.BSCScan.APIKey,
			cfg.Blockchain.BSCScan.RateLimit,
		)
	default:
		logger.Fatal("Unsupported network", zap.String("network", cfg.Blockchain.Network))
	}
	if err != nil {
		logger.Fatal("Failed to create blockchain client", zap.Error(err))
	}
	defer blockchainClient.Close()

	// Initialize Kafka producer
	kafkaProducer, err := producer.NewKafkaProducer(&cfg.Kafka, logger)
	if err != nil {
		logger.Fatal("Failed to create Kafka producer", zap.Error(err))
	}
	defer kafkaProducer.Close()

	// Initialize ingestion service
	ingestionService := service.NewService(cfg, blockchainClient, kafkaProducer, logger)

	// Start metrics server
	if cfg.Metrics.Enabled {
		go startMetricsServer(cfg.Metrics, logger)
	}

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

func startMetricsServer(cfg config.MetricsConfig, logger *zap.Logger) {
	mux := http.NewServeMux()
	mux.Handle(cfg.Path, promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	logger.Info("Starting metrics server", zap.String("addr", addr))

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("Metrics server error", zap.Error(err))
	}
}
