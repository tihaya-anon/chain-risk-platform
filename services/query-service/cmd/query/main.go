package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/0ksks/chain-risk-platform/query-service/internal/config"
	"github.com/0ksks/chain-risk-platform/query-service/internal/handler"
	"github.com/0ksks/chain-risk-platform/query-service/internal/nacos"
	"github.com/0ksks/chain-risk-platform/query-service/internal/repository"
	"github.com/0ksks/chain-risk-platform/query-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	_ "github.com/0ksks/chain-risk-platform/query-service/docs"
)

var (
	configPath = flag.String("config", "configs/config.yaml", "path to config file")
	version    = "dev"
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
	zapLogger, err := initLogger(cfg.Logging)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer zapLogger.Sync()

	zapLogger.Info("Starting query service",
		zap.String("version", version),
		zap.String("env", cfg.Server.Env),
		zap.Int("port", cfg.Server.Port))

	// Initialize Nacos client (optional)
	var nacosClient *nacos.Client
	if nacosServer := os.Getenv("NACOS_SERVER"); nacosServer != "" {
		nacosClient, err = initNacosClient(cfg.Server.Port, zapLogger)
		if err != nil {
			zapLogger.Warn("Failed to initialize Nacos client, running without Nacos", zap.Error(err))
		} else {
			zapLogger.Info("Nacos client initialized", zap.String("server", nacosServer))

			// Register service with Nacos
			if err := nacosClient.RegisterService(map[string]string{
				"version": version,
				"env":     cfg.Server.Env,
			}); err != nil {
				zapLogger.Warn("Failed to register service with Nacos", zap.Error(err))
			}
		}
	} else {
		zapLogger.Info("NACOS_SERVER not set, running without Nacos integration")
	}

	// Initialize database
	db, err := initDatabase(cfg.Database, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Initialize Redis (optional)
	var redisClient *redis.Client
	redisClient, err = initRedis(cfg.Redis)
	if err != nil {
		zapLogger.Warn("Failed to connect to Redis, caching disabled", zap.Error(err))
		redisClient = nil
	} else {
		zapLogger.Info("Connected to Redis", zap.String("addr", cfg.Redis.Addr()))
	}

	// Initialize repositories
	transferRepo := repository.NewTransferRepository(db)

	// Initialize services
	queryService := service.NewQueryService(transferRepo, redisClient, cfg, zapLogger)

	// Initialize handlers
	transferHandler := handler.NewTransferHandler(queryService, zapLogger)
	addressHandler := handler.NewAddressHandler(queryService, zapLogger)

	// Setup router
	router := setupRouter(cfg, transferHandler, addressHandler, nacosClient, zapLogger)

	// Start server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	zapLogger.Info("Server started", zap.Int("port", cfg.Server.Port))

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("Shutting down server...")

	// Cleanup Nacos
	if nacosClient != nil {
		nacosClient.Close()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Error("Server forced to shutdown", zap.Error(err))
	}

	// Close Redis connection
	if redisClient != nil {
		if err := redisClient.Close(); err != nil {
			zapLogger.Error("Failed to close Redis connection", zap.Error(err))
		}
	}

	zapLogger.Info("Server stopped")
}

func initNacosClient(servicePort int, logger *zap.Logger) (*nacos.Client, error) {
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

	// Get service IP
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
		ServiceName: "query-service",
		ServiceIP:   serviceIP,
		ServicePort: uint64(servicePort),
	}

	return nacos.NewClient(nacosCfg, logger)
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

	// Configure output paths
	if len(cfg.OutputPaths) > 0 {
		zapCfg.OutputPaths = cfg.OutputPaths
		zapCfg.ErrorOutputPaths = cfg.OutputPaths

		// Ensure log directory exists for file outputs
		for _, path := range cfg.OutputPaths {
			if path != "stdout" && path != "stderr" {
				dir := filepath.Dir(path)
				if err := os.MkdirAll(dir, 0755); err != nil {
					return nil, fmt.Errorf("create log directory: %w", err)
				}
			}
		}
	}

	return zapCfg.Build()
}

func initDatabase(cfg config.DatabaseConfig, zapLogger *zap.Logger) (*gorm.DB, error) {
	// Configure GORM logger
	gormLogger := logger.New(
		&zapLogAdapter{zapLogger},
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	zapLogger.Info("Connected to database",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("dbname", cfg.DBName))

	return db, nil
}

func initRedis(cfg config.RedisConfig) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return client, nil
}

func setupRouter(cfg *config.Config, transferHandler *handler.TransferHandler, addressHandler *handler.AddressHandler, nacosClient *nacos.Client, zapLogger *zap.Logger) *gin.Engine {
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(requestLogger(zapLogger))
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Admin status endpoint (if Nacos is enabled)
	if nacosClient != nil {
		router.GET("/admin/status", func(c *gin.Context) {
			config := nacosClient.GetConfig()
			c.JSON(http.StatusOK, gin.H{
				"service": "query-service",
				"status":  "healthy",
				"nacos":   true,
				"config": gin.H{
					"pipelineEnabled": config.Pipeline.Enabled,
					"cacheTtlSeconds": config.Risk.CacheTtlSeconds,
				},
			})
		})
	}

	// Swagger docs (disabled in production)
	if cfg.Server.Env != "production" {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
		zapLogger.Info("Swagger UI enabled", zap.String("url", "/swagger/index.html"))
	}

	api := router.Group("/api/v1")
	{
		// Register all handlers that implement RouteRegistrar interface
		handler.RegisterAll(api,
			transferHandler,
			addressHandler,
		)
	}

	return router
}

func requestLogger(zapLogger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		zapLogger.Info("HTTP Request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", status),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
		)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// zapLogAdapter adapts zap.Logger to GORM's logger interface
type zapLogAdapter struct {
	logger *zap.Logger
}

func (l *zapLogAdapter) Printf(format string, args ...interface{}) {
	l.logger.Sugar().Infof(format, args...)
}
