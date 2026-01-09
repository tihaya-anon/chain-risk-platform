package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/config"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/generator"
	"github.com/0ksks/chain-risk-platform/data-ingestion/internal/producer"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	configPath   = flag.String("config", "configs/config.yaml", "path to config file")
	mode         = flag.String("mode", "random", "generator mode: random, scenario")
	scenarioFile = flag.String("scenario", "", "scenario file path (required for scenario mode)")
	tps          = flag.Float64("tps", 10, "transactions per second (1-1000)")
	duration     = flag.Int("duration", 0, "duration in seconds (0 = infinite)")
	network      = flag.String("network", "ethereum", "network: ethereum, bsc")
	dryRun       = flag.Bool("dry-run", false, "dry run mode (no Kafka)")
)

func main() {
	flag.Parse()

	logger, err := initLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Starting data generator",
		zap.String("mode", *mode),
		zap.Float64("tps", *tps),
		zap.String("network", *network))

	// Validate TPS
	if *tps < 1 || *tps > 1000 {
		logger.Fatal("TPS must be between 1 and 1000")
	}

	// Load config for Kafka settings
	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.Fatal("Failed to load config", zap.Error(err))
	}

	// Create producer
	var msgProducer producer.Producer
	if *dryRun {
		msgProducer = generator.NewDryRunProducer(logger)
		logger.Info("Dry-run mode enabled - no messages will be sent to Kafka")
	} else {
		msgProducer, err = producer.NewProducer(&cfg.Kafka, logger)
		if err != nil {
			logger.Fatal("Failed to create producer", zap.Error(err))
		}
	}
	defer msgProducer.Close()

	// Create generator config
	genCfg := &generator.Config{
		Mode:         *mode,
		ScenarioFile: *scenarioFile,
		TPS:          *tps,
		Duration:     *duration,
		Network:      *network,
	}

	// Create generator
	gen, err := generator.New(genCfg, msgProducer, logger)
	if err != nil {
		logger.Fatal("Failed to create generator", zap.Error(err))
	}

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		logger.Info("Received signal, shutting down", zap.String("signal", sig.String()))
		cancel()
	}()

	// Run generator
	if err := gen.Run(ctx); err != nil && err != context.Canceled {
		logger.Error("Generator error", zap.Error(err))
		os.Exit(1)
	}

	logger.Info("Generator stopped")
}

func initLogger() (*zap.Logger, error) {
	config := zap.NewDevelopmentConfig()
	config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	return config.Build()
}
