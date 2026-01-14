package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/client"
	"github.com/chain-risk-platform/alert-service/internal/config"
	"github.com/chain-risk-platform/alert-service/internal/dedup"
	"github.com/chain-risk-platform/alert-service/internal/engine"
	"github.com/chain-risk-platform/alert-service/internal/handler"
	"github.com/chain-risk-platform/alert-service/internal/kafka"
	"github.com/chain-risk-platform/alert-service/internal/metrics"
	"github.com/chain-risk-platform/alert-service/internal/nacos"
	"github.com/chain-risk-platform/alert-service/internal/notifier"
	"github.com/chain-risk-platform/alert-service/internal/repository"
	"github.com/chain-risk-platform/alert-service/internal/service"
	"github.com/chain-risk-platform/alert-service/pkg/audit"
	"github.com/chain-risk-platform/alert-service/pkg/ratelimit"
	"github.com/chain-risk-platform/alert-service/pkg/tls"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	version = "1.0.0"
)

func main() {
	// Parse command-line flags
	configPath := flag.String("config", "configs/config.yaml", "Path to config file")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	logger := initLogger(cfg.Logging)
	defer logger.Sync()

	logger.Info("Starting Alert Service",
		zap.String("version", version),
		zap.Int("port", cfg.Server.Port),
	)

	// Initialize Nacos client (optional)
	var nacosClient *nacos.Client
	if nacosServer := os.Getenv("NACOS_SERVER"); nacosServer != "" {
		nacosClient, err = initNacosClient(cfg.Server.Port, logger)
		if err != nil {
			logger.Warn("Failed to initialize Nacos client, running without Nacos", zap.Error(err))
		} else {
			logger.Info("Nacos client initialized", zap.String("server", nacosServer))

			if err := nacosClient.RegisterService(map[string]string{
				"version": version,
				"env":     cfg.Server.Mode,
			}); err != nil {
				logger.Warn("Failed to register service with Nacos", zap.Error(err))
			}
		}
	} else {
		logger.Info("NACOS_SERVER not set, running without Nacos integration")
	}

	// Initialize database
	db, err := initDatabase(cfg)
	if err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer db.Close()

	// Initialize Redis
	redisClient := initRedis(cfg)
	defer redisClient.Close()

	// Test connections
	if err := testConnections(db, redisClient); err != nil {
		logger.Fatal("Connection test failed", zap.Error(err))
	}

	// Initialize repositories
	ruleRepo := repository.NewAlertRuleRepository(db)
	historyRepo := repository.NewAlertHistoryRepository(db)
	subsRepo := repository.NewAlertSubscriptionRepository(db)

	logger.Info("Repositories initialized")

	// Initialize external clients
	graphClient := client.NewGraphServiceClient(
		cfg.Services.GraphService.URL,
		cfg.Services.GraphService.Timeout,
		logger,
	)

	// Initialize evaluators
	evalRegistry := engine.NewEvaluatorRegistry()
	evalRegistry.Register(engine.NewRiskScoreEvaluator())
	evalRegistry.Register(engine.NewTransactionValueEvaluator())
	evalRegistry.Register(engine.NewTagMatchEvaluator(graphClient))

	logger.Info("Evaluators registered",
		zap.Strings("types", evalRegistry.SupportedRuleTypes()))

	// Initialize deduplicator
	deduplicator := dedup.NewDeduplicator(redisClient, cfg.Alert.DedupWindow, logger)

	// Initialize alert engine
	alertEngine := engine.NewAlertEngine(evalRegistry, ruleRepo, deduplicator, logger)

	// Initialize notifiers
	notifierRegistry := notifier.NewNotifierRegistry()

	if cfg.Notifiers.Webhook.Enabled {
		notifierRegistry.Register(notifier.NewWebhookNotifier(cfg.Notifiers.Webhook.Timeout, logger))
	}

	if cfg.Notifiers.Email.Enabled {
		notifierRegistry.Register(notifier.NewEmailNotifier(notifier.EmailConfig{
			SMTPHost:     cfg.Notifiers.Email.SMTPHost,
			SMTPPort:     cfg.Notifiers.Email.SMTPPort,
			SMTPUser:     cfg.Notifiers.Email.SMTPUser,
			SMTPPassword: cfg.Notifiers.Email.SMTPPassword,
			From:         cfg.Notifiers.Email.From,
		}, logger))
	}

	if cfg.Notifiers.Slack.Enabled {
		notifierRegistry.Register(notifier.NewSlackNotifier(cfg.Notifiers.Slack.Timeout, logger))
	}

	logger.Info("Notifiers registered",
		zap.Strings("channels", notifierRegistry.SupportedChannels()))

	// Initialize dispatcher
	dispatcher := notifier.NewDispatcher(
		notifierRegistry,
		cfg.Alert.RetryAttempts,
		cfg.Alert.RetryDelay,
		logger,
	)

	// Initialize service
	alertService := service.NewAlertService(
		ruleRepo,
		historyRepo,
		subsRepo,
		alertEngine,
		dispatcher,
		logger,
	)

	// Initialize handlers
	ruleHandler := handler.NewAlertRuleHandler(alertService, logger)
	historyHandler := handler.NewAlertHistoryHandler(alertService, logger)
	subsHandler := handler.NewSubscriptionHandler(alertService, logger)
	testHandler := handler.NewTestAlertHandler(alertService, logger)

	// Initialize security components
	auditLogger := audit.NewLogger(audit.Config{
		ServiceName: "alert-service",
		Output:      "stdout",
		Format:      "json",
	})
	rateLimiter := ratelimit.NewWithConfig(ratelimit.Config{
		RequestsPerMinute: 60,
		BurstSize:         12,
		CleanupInterval:   5 * time.Minute,
		MaxEntries:        10000,
	})
	defer rateLimiter.Stop()

	// Initialize Gin router with security middleware
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Core middleware
	router.Use(gin.Recovery())
	router.Use(metrics.Middleware())

	// Security middleware
	router.Use(rateLimiter.Middleware())
	router.Use(audit.Middleware(auditLogger))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "alert-service",
			"time":    time.Now().Format(time.RFC3339),
		})
	})

	// Prometheus metrics endpoint
	router.GET("/metrics", metrics.Handler())

	// Admin status endpoint (with Nacos info)
	router.GET("/admin/status", func(c *gin.Context) {
		status := gin.H{
			"service":     "alert-service",
			"version":     version,
			"status":      "healthy",
			"tls_enabled": tls.LoadFromEnv().Enabled,
		}

		if nacosClient != nil {
			config := nacosClient.GetConfig()
			status["nacos"] = true
			status["config"] = gin.H{
				"pipelineEnabled": config.Pipeline.Enabled,
			}
		} else {
			status["nacos"] = false
		}

		c.JSON(http.StatusOK, status)
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	handler.RegisterAll(v1,
		ruleHandler,
		historyHandler,
		subsHandler,
		testHandler,
	)

	// Load TLS configuration
	tlsCfg := tls.LoadFromEnv()

	// Create HTTP server with TLS support
	srv, err := tls.NewServer(fmt.Sprintf(":%d", cfg.Server.Port), router, tlsCfg)
	if err != nil {
		logger.Fatal("Failed to create server", zap.Error(err))
	}

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Kafka consumer
	var kafkaConsumer *kafka.Consumer
	if len(cfg.Kafka.Brokers) > 0 {
		kafkaConsumer = kafka.NewConsumer(kafka.Config{
			Brokers:           cfg.Kafka.Brokers,
			GroupID:           cfg.Kafka.GroupID,
			RiskScoresTopic:   cfg.Kafka.Topics.RiskScores,
			TransfersTopic:    cfg.Kafka.Topics.Transfers,
			SessionTimeout:    cfg.Kafka.SessionTimeout,
			HeartbeatInterval: cfg.Kafka.HeartbeatInterval,
		}, alertService, logger)

		go func() {
			logger.Info("Starting Kafka consumer")
			if err := kafkaConsumer.Start(ctx); err != nil && err != context.Canceled {
				logger.Error("Kafka consumer error", zap.Error(err))
			}
		}()
	} else {
		logger.Warn("Kafka not configured, running in API-only mode")
	}

	// Start HTTP server
	go func() {
		if srv.IsTLSEnabled() {
			logger.Info("Starting HTTPS server with TLS",
				zap.Int("port", cfg.Server.Port),
				zap.String("mtls_mode", tlsCfg.MTLSMode))
		} else {
			logger.Info("Starting HTTP server (TLS disabled)",
				zap.Int("port", cfg.Server.Port))
		}

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Cancel context to stop Kafka consumer
	cancel()

	// Cleanup Nacos
	if nacosClient != nil {
		nacosClient.Close()
	}

	// Stop Kafka consumer
	if kafkaConsumer != nil {
		if err := kafkaConsumer.Stop(); err != nil {
			logger.Error("Failed to stop Kafka consumer", zap.Error(err))
		}
	}

	// Graceful HTTP shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}

func initNacosClient(servicePort int, logger *zap.Logger) (*nacos.Client, error) {
	nacosServer := os.Getenv("NACOS_SERVER")
	if nacosServer == "" {
		return nil, fmt.Errorf("NACOS_SERVER not set")
	}

	serverAddr, serverPort := nacos.ParseServerAddr(nacosServer)

	serviceIP := os.Getenv("SERVICE_IP")
	if serviceIP == "" {
		serviceIP = "127.0.0.1"
	}

	nacosCfg := &nacos.Config{
		ServerAddr:  serverAddr,
		ServerPort:  serverPort,
		NamespaceID: os.Getenv("NACOS_NAMESPACE"),
		Username:    os.Getenv("NACOS_USERNAME"),
		Password:    os.Getenv("NACOS_PASSWORD"),
		ServiceName: "alert-service",
		ServiceIP:   serviceIP,
		ServicePort: uint64(servicePort),
	}

	return nacos.NewClient(nacosCfg, logger)
}

func initLogger(cfg config.LoggingConfig) *zap.Logger {
	level := zapcore.InfoLevel
	switch cfg.Level {
	case "debug":
		level = zapcore.DebugLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	}

	zapCfg := zap.Config{
		Level:            zap.NewAtomicLevelAt(level),
		Development:      false,
		Encoding:         cfg.Encoding,
		EncoderConfig:    zap.NewProductionEncoderConfig(),
		OutputPaths:      cfg.OutputPaths,
		ErrorOutputPaths: cfg.ErrorOutputPaths,
	}

	logger, err := zapCfg.Build()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}

	return logger
}

func initDatabase(cfg *config.Config) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.GetDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

func initRedis(cfg *config.Config) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     cfg.GetRedisAddr(),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
		PoolSize: cfg.Redis.PoolSize,
	})
}

func testConnections(db *sql.DB, redisClient *redis.Client) error {
	if err := db.Ping(); err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis connection failed: %w", err)
	}

	return nil
}
