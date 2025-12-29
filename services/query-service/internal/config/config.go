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

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Logging  LoggingConfig  `mapstructure:"logging"`
	API      APIConfig      `mapstructure:"api"`
}

type ServerConfig struct {
	Name string `mapstructure:"name"`
	Port int    `mapstructure:"port"`
	Env  string `mapstructure:"env"`
}

type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	DBName          string        `mapstructure:"dbname"`
	SSLMode         string        `mapstructure:"sslmode"`
	MaxOpenConns    int           `mapstructure:"maxOpenConns"`
	MaxIdleConns    int           `mapstructure:"maxIdleConns"`
	ConnMaxLifetime time.Duration `mapstructure:"connMaxLifetime"`
}

type RedisConfig struct {
	Host     string         `mapstructure:"host"`
	Port     int            `mapstructure:"port"`
	Password string         `mapstructure:"password"`
	DB       int            `mapstructure:"db"`
	CacheTTL CacheTTLConfig `mapstructure:"cacheTTL"`
}

type CacheTTLConfig struct {
	Address   time.Duration `mapstructure:"address"`
	Transfers time.Duration `mapstructure:"transfers"`
	Stats     time.Duration `mapstructure:"stats"`
}

type LoggingConfig struct {
	Level       string   `mapstructure:"level"`
	Format      string   `mapstructure:"format"`
	OutputPaths []string `mapstructure:"outputPaths"`
}

type APIConfig struct {
	DefaultPageSize int             `mapstructure:"defaultPageSize"`
	MaxPageSize     int             `mapstructure:"maxPageSize"`
	RateLimit       RateLimitConfig `mapstructure:"rateLimit"`
}

type RateLimitConfig struct {
	Enabled           bool `mapstructure:"enabled"`
	RequestsPerSecond int  `mapstructure:"requestsPerSecond"`
}

// Load reads configuration from file and environment variables
func Load(configPath string) (*Config, error) {
	// Load .env.local file if exists
	configDir := filepath.Dir(configPath)
	envPaths := []string{
		filepath.Join(configDir, "..", "..", ".env.local"),
		filepath.Join(configDir, "..", ".env.local"),
		".env.local",
	}
	for _, envPath := range envPaths {
		if _, err := os.Stat(envPath); err == nil {
			_ = godotenv.Load(envPath)
			break
		}
	}

	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	// Override with environment variables
	overrideFromEnv(&cfg)

	// Set defaults
	setDefaults(&cfg)

	return &cfg, nil
}

func overrideFromEnv(cfg *Config) {
	// Database
	if host := os.Getenv("POSTGRES_HOST"); host != "" {
		cfg.Database.Host = host
	}
	if port := os.Getenv("POSTGRES_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &cfg.Database.Port)
	}

	// Redis
	if host := os.Getenv("REDIS_HOST"); host != "" {
		cfg.Redis.Host = host
	}
	if port := os.Getenv("REDIS_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &cfg.Redis.Port)
	}
}

func setDefaults(cfg *Config) {
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8081
	}
	if cfg.Database.MaxOpenConns == 0 {
		cfg.Database.MaxOpenConns = 25
	}
	if cfg.Database.MaxIdleConns == 0 {
		cfg.Database.MaxIdleConns = 10
	}
	if cfg.Database.ConnMaxLifetime == 0 {
		cfg.Database.ConnMaxLifetime = 5 * time.Minute
	}
	if cfg.API.DefaultPageSize == 0 {
		cfg.API.DefaultPageSize = 20
	}
	if cfg.API.MaxPageSize == 0 {
		cfg.API.MaxPageSize = 100
	}
	if cfg.Redis.CacheTTL.Address == 0 {
		cfg.Redis.CacheTTL.Address = 5 * time.Minute
	}
	if cfg.Redis.CacheTTL.Transfers == 0 {
		cfg.Redis.CacheTTL.Transfers = 2 * time.Minute
	}
	if cfg.Redis.CacheTTL.Stats == 0 {
		cfg.Redis.CacheTTL.Stats = 1 * time.Minute
	}
}

// DSN returns the PostgreSQL connection string
func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}

// RedisAddr returns the Redis address
func (c *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
