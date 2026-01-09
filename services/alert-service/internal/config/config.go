package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig    `mapstructure:"server"`
	Kafka     KafkaConfig     `mapstructure:"kafka"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	Alert     AlertConfig     `mapstructure:"alert"`
	Notifiers NotifiersConfig `mapstructure:"notifiers"`
	Logging   LoggingConfig   `mapstructure:"logging"`
	Nacos     NacosConfig     `mapstructure:"nacos"`
	Services  ServicesConfig  `mapstructure:"services"`
}

type ServerConfig struct {
	Port         int           `mapstructure:"port"`
	Mode         string        `mapstructure:"mode"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
}

type KafkaConfig struct {
	Brokers           []string      `mapstructure:"brokers"`
	Topics            TopicsConfig  `mapstructure:"topics"`
	GroupID           string        `mapstructure:"group_id"`
	SessionTimeout    time.Duration `mapstructure:"session_timeout"`
	HeartbeatInterval time.Duration `mapstructure:"heartbeat_interval"`
}

type TopicsConfig struct {
	RiskScores string `mapstructure:"risk_scores"`
	Transfers  string `mapstructure:"transfers"`
}

type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	Database        string        `mapstructure:"database"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	MaxOpenConns    int           `mapstructure:"max_open_conns"`
	MaxIdleConns    int           `mapstructure:"max_idle_conns"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

type AlertConfig struct {
	DedupWindow         time.Duration `mapstructure:"dedup_window"`
	BatchSize           int           `mapstructure:"batch_size"`
	RetryAttempts       int           `mapstructure:"retry_attempts"`
	RetryDelay          time.Duration `mapstructure:"retry_delay"`
	MaxAlertsPerMinute  int           `mapstructure:"max_alerts_per_minute"`
}

type NotifiersConfig struct {
	Email   EmailConfig   `mapstructure:"email"`
	Webhook WebhookConfig `mapstructure:"webhook"`
	Slack   SlackConfig   `mapstructure:"slack"`
}

type EmailConfig struct {
	Enabled      bool   `mapstructure:"enabled"`
	SMTPHost     string `mapstructure:"smtp_host"`
	SMTPPort     int    `mapstructure:"smtp_port"`
	SMTPUser     string `mapstructure:"smtp_user"`
	SMTPPassword string `mapstructure:"smtp_password"`
	From         string `mapstructure:"from"`
}

type WebhookConfig struct {
	Enabled    bool          `mapstructure:"enabled"`
	Timeout    time.Duration `mapstructure:"timeout"`
	MaxRetries int           `mapstructure:"max_retries"`
}

type SlackConfig struct {
	Enabled           bool          `mapstructure:"enabled"`
	Timeout           time.Duration `mapstructure:"timeout"`
	DefaultWebhookURL string        `mapstructure:"default_webhook_url"`
}

type LoggingConfig struct {
	Level            string   `mapstructure:"level"`
	Encoding         string   `mapstructure:"encoding"`
	OutputPaths      []string `mapstructure:"output_paths"`
	ErrorOutputPaths []string `mapstructure:"error_output_paths"`
}

type NacosConfig struct {
	Enabled    bool          `mapstructure:"enabled"`
	ServerAddr string        `mapstructure:"server_addr"`
	Namespace  string        `mapstructure:"namespace"`
	Group      string        `mapstructure:"group"`
	DataID     string        `mapstructure:"data_id"`
	Timeout    time.Duration `mapstructure:"timeout"`
}

type ServicesConfig struct {
	RiskService  ServiceEndpoint `mapstructure:"risk_service"`
	GraphService ServiceEndpoint `mapstructure:"graph_service"`
}

type ServiceEndpoint struct {
	URL     string        `mapstructure:"url"`
	Timeout time.Duration `mapstructure:"timeout"`
}

func Load(configPath string) (*Config, error) {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	// Set defaults
	setDefaults()

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Unmarshal config
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

func setDefaults() {
	viper.SetDefault("server.port", 8083)
	viper.SetDefault("server.mode", "release")
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")

	viper.SetDefault("kafka.group_id", "alert-service")
	viper.SetDefault("kafka.session_timeout", "10s")
	viper.SetDefault("kafka.heartbeat_interval", "3s")

	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", "5m")

	viper.SetDefault("redis.db", 2)
	viper.SetDefault("redis.pool_size", 10)

	viper.SetDefault("alert.dedup_window", "5m")
	viper.SetDefault("alert.batch_size", 100)
	viper.SetDefault("alert.retry_attempts", 3)
	viper.SetDefault("alert.retry_delay", "5s")
	viper.SetDefault("alert.max_alerts_per_minute", 100)

	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.encoding", "json")
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Database,
	)
}

func (c *Config) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Redis.Host, c.Redis.Port)
}
