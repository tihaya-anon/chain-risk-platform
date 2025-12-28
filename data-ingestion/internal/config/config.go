package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config holds all configuration for the service
type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Blockchain BlockchainConfig `mapstructure:"blockchain"`
	Kafka      KafkaConfig      `mapstructure:"kafka"`
	Logging    LoggingConfig    `mapstructure:"logging"`
	Metrics    MetricsConfig    `mapstructure:"metrics"`
}

type ServerConfig struct {
	Name string `mapstructure:"name"`
	Env  string `mapstructure:"env"`
}

type BlockchainConfig struct {
	Network   string          `mapstructure:"network"`
	Etherscan EtherscanConfig `mapstructure:"etherscan"`
	BSCScan   EtherscanConfig `mapstructure:"bscscan"`
	Polling   PollingConfig   `mapstructure:"polling"`
}

type EtherscanConfig struct {
	BaseURL   string `mapstructure:"baseUrl"`
	APIKey    string `mapstructure:"apiKey"`
	RateLimit int    `mapstructure:"rateLimit"`
}

type PollingConfig struct {
	IntervalSeconds  int    `mapstructure:"intervalSeconds"`
	BatchSize        int    `mapstructure:"batchSize"`
	StartBlock       string `mapstructure:"startBlock"`
	Confirmations    int    `mapstructure:"confirmations"`
	EnableInternalTx bool   `mapstructure:"enableInternalTx"`
}

type KafkaConfig struct {
	Brokers  []string            `mapstructure:"brokers"`
	Topic    string              `mapstructure:"topic"`
	Producer KafkaProducerConfig `mapstructure:"producer"`
}

type KafkaProducerConfig struct {
	MaxRetries     int    `mapstructure:"maxRetries"`
	RetryBackoffMs int    `mapstructure:"retryBackoffMs"`
	RequiredAcks   int    `mapstructure:"requiredAcks"`
	Compression    string `mapstructure:"compression"`
}

type LoggingConfig struct {
	Level       string   `mapstructure:"level"`
	Format      string   `mapstructure:"format"`
	OutputPaths []string `mapstructure:"outputPaths"`
}

type MetricsConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	Port    int    `mapstructure:"port"`
	Path    string `mapstructure:"path"`
}

// Load reads configuration from file and environment variables
func Load(configPath string) (*Config, error) {
	// Load .env.local file if exists (from project root)
	// Try to find .env.local relative to config file location
	configDir := filepath.Dir(configPath)
	envPaths := []string{
		filepath.Join(configDir, "..", ".env.local"),
		".env.local",
		"../.env.local",
	}
	for _, envPath := range envPaths {
		if _, err := os.Stat(envPath); err == nil {
			_ = godotenv.Load(envPath)
			break
		}
	}

	v := viper.New()

	// Set config file
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	// Environment variables
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		return nil, err
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// Override with environment variables
	overrideFromEnv(&cfg)

	// Set defaults
	setDefaults(&cfg)

	return &cfg, nil
}

// overrideFromEnv overrides config values from environment variables
func overrideFromEnv(cfg *Config) {
	// Kafka brokers: KAFKA_BROKERS or DOCKER_HOST_IP:19092
	if brokers := os.Getenv("KAFKA_BROKERS"); brokers != "" {
		cfg.Kafka.Brokers = strings.Split(brokers, ",")
	} else if dockerIP := os.Getenv("DOCKER_HOST_IP"); dockerIP != "" {
		cfg.Kafka.Brokers = []string{fmt.Sprintf("%s:19092", dockerIP)}
	}

	// Etherscan API Key
	if apiKey := os.Getenv("ETHERSCAN_API_KEY"); apiKey != "" {
		cfg.Blockchain.Etherscan.APIKey = apiKey
	}

	// BSCScan API Key
	if apiKey := os.Getenv("BSCSCAN_API_KEY"); apiKey != "" {
		cfg.Blockchain.BSCScan.APIKey = apiKey
	}
}

func setDefaults(cfg *Config) {
	if cfg.Blockchain.Polling.IntervalSeconds == 0 {
		cfg.Blockchain.Polling.IntervalSeconds = 12
	}
	if cfg.Blockchain.Polling.BatchSize == 0 {
		cfg.Blockchain.Polling.BatchSize = 10
	}
	if cfg.Blockchain.Polling.Confirmations == 0 {
		cfg.Blockchain.Polling.Confirmations = 12
	}
	if cfg.Kafka.Topic == "" {
		cfg.Kafka.Topic = "chain-transactions"
	}
	if cfg.Logging.Level == "" {
		cfg.Logging.Level = "info"
	}
}

// GetPollingInterval returns the polling interval as time.Duration
func (c *Config) GetPollingInterval() time.Duration {
	return time.Duration(c.Blockchain.Polling.IntervalSeconds) * time.Second
}
