package framework

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/IBM/sarama"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/redis/go-redis/v9"
)

// TestEnv holds all test environment connections
type TestEnv struct {
	Config      *Config
	DB          *sql.DB
	Redis       *redis.Client
	Neo4j       neo4j.DriverWithContext
	KafkaAdmin  sarama.ClusterAdmin
	HTTPClient  *http.Client
	ctx         context.Context
	cancel      context.CancelFunc
}

// Config holds test configuration
type Config struct {
	PostgresHost     string
	PostgresPort     string
	PostgresUser     string
	PostgresPassword string
	PostgresDB       string
	RedisHost        string
	RedisPort        string
	Neo4jURI         string
	Neo4jUser        string
	Neo4jPassword    string
	KafkaBrokers     []string
	KafkaTopic       string
	QueryServiceURL  string
	RiskServiceURL   string
	GraphServiceURL  string
	AlertServiceURL  string
	BFFURL           string
	GeneratorBin     string
}

// LoadConfig loads configuration from environment
func LoadConfig() *Config {
	dockerHost := getEnv("DOCKER_HOST_IP", "localhost")

	return &Config{
		PostgresHost:     getEnv("POSTGRES_HOST", dockerHost),
		PostgresPort:     getEnv("POSTGRES_PORT", "15432"),
		PostgresUser:     getEnv("POSTGRES_USER", "chainrisk"),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", "chainrisk123"),
		PostgresDB:       getEnv("POSTGRES_DB", "chainrisk"),
		RedisHost:        getEnv("REDIS_HOST", dockerHost),
		RedisPort:        getEnv("REDIS_PORT", "16379"),
		Neo4jURI:         getEnv("NEO4J_URI", fmt.Sprintf("bolt://%s:17687", dockerHost)),
		Neo4jUser:        getEnv("NEO4J_USER", "neo4j"),
		Neo4jPassword:    getEnv("NEO4J_PASSWORD", "chainrisk123"),
		KafkaBrokers:     []string{getEnv("KAFKA_BROKERS", fmt.Sprintf("%s:19092", dockerHost))},
		KafkaTopic:       getEnv("KAFKA_TOPIC", "chain-transactions"),
		QueryServiceURL:  getEnv("QUERY_SERVICE_URL", "http://localhost:8081"),
		RiskServiceURL:   getEnv("RISK_SERVICE_URL", "http://localhost:8082"),
		GraphServiceURL:  getEnv("GRAPH_SERVICE_URL", "http://localhost:8084"),
		AlertServiceURL:  getEnv("ALERT_SERVICE_URL", "http://localhost:8085"),
		BFFURL:           getEnv("BFF_URL", "http://localhost:3001"),
		GeneratorBin:     getEnv("GENERATOR_BIN", "../data-ingestion/bin/generator"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// Setup initializes test environment
func Setup(ctx context.Context) (*TestEnv, error) {
	cfg := LoadConfig()

	ctx, cancel := context.WithCancel(ctx)
	env := &TestEnv{
		Config: cfg,
		ctx:    ctx,
		cancel: cancel,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	// Connect PostgreSQL
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.PostgresHost, cfg.PostgresPort, cfg.PostgresUser, cfg.PostgresPassword, cfg.PostgresDB)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	env.DB = db

	// Connect Redis
	env.Redis = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
	})
	if err := env.Redis.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	// Connect Neo4j
	driver, err := neo4j.NewDriverWithContext(cfg.Neo4jURI, neo4j.BasicAuth(cfg.Neo4jUser, cfg.Neo4jPassword, ""))
	if err != nil {
		return nil, fmt.Errorf("connect neo4j: %w", err)
	}
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return nil, fmt.Errorf("verify neo4j: %w", err)
	}
	env.Neo4j = driver

	// Connect Kafka Admin
	kafkaCfg := sarama.NewConfig()
	kafkaCfg.Version = sarama.V2_8_0_0
	admin, err := sarama.NewClusterAdmin(cfg.KafkaBrokers, kafkaCfg)
	if err != nil {
		return nil, fmt.Errorf("connect kafka admin: %w", err)
	}
	env.KafkaAdmin = admin

	return env, nil
}

// Teardown cleans up test environment
func (e *TestEnv) Teardown() error {
	var errs []error

	if e.DB != nil {
		if err := e.DB.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close postgres: %w", err))
		}
	}

	if e.Redis != nil {
		if err := e.Redis.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close redis: %w", err))
		}
	}

	if e.Neo4j != nil {
		if err := e.Neo4j.Close(e.ctx); err != nil {
			errs = append(errs, fmt.Errorf("close neo4j: %w", err))
		}
	}

	if e.KafkaAdmin != nil {
		if err := e.KafkaAdmin.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close kafka: %w", err))
		}
	}

	e.cancel()

	if len(errs) > 0 {
		return fmt.Errorf("teardown errors: %v", errs)
	}
	return nil
}

// Context returns the test context
func (e *TestEnv) Context() context.Context {
	return e.ctx
}
