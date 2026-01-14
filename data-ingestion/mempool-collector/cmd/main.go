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

	"github.com/chain-risk-platform/mempool-collector/internal/collector"
	"github.com/chain-risk-platform/mempool-collector/internal/config"
	"github.com/chain-risk-platform/mempool-collector/internal/handler"
	"github.com/chain-risk-platform/mempool-collector/internal/producer"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

func main() {
	configPath := flag.String("config", "", "Path to config file")
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.Fatal("Failed to load config", zap.Error(err))
	}

	metrics := collector.NewMetrics("mempool_collector")

	// Collector
	c := collector.NewCollector(&cfg.Ethereum, logger, metrics)

	// Kafka producer
	kafkaProducer, err := producer.NewKafkaProducer(&cfg.Kafka, logger, metrics)
	if err != nil {
		logger.Fatal("Failed to create Kafka producer", zap.Error(err))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start collector
	if err := c.Start(ctx); err != nil {
		logger.Fatal("Failed to start collector", zap.Error(err))
	}

	// Process transactions
	go func() {
		for tx := range c.TxChannel() {
			if err := kafkaProducer.Produce(ctx, tx); err != nil {
				logger.Error("Failed to produce message", zap.Error(err))
			}
		}
	}()

	// Admin server
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	adminHandler := handler.NewAdminHandler(c)
	adminHandler.RegisterRoutes(router)

	adminServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		logger.Info("Starting admin server", zap.Int("port", cfg.Server.Port))
		if err := adminServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Admin server error", zap.Error(err))
		}
	}()

	// Metrics server
	if cfg.Metrics.Enabled {
		go func() {
			metricsAddr := fmt.Sprintf(":%d", cfg.Metrics.Port)
			logger.Info("Starting metrics server", zap.String("addr", metricsAddr))
			http.Handle("/metrics", promhttp.Handler())
			http.ListenAndServe(metricsAddr, nil)
		}()
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Info("Shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	adminServer.Shutdown(shutdownCtx)
	c.Stop()
	kafkaProducer.Close()

	logger.Info("Shutdown complete")
}
