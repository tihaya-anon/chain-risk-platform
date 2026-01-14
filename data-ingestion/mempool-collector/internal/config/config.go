package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Ethereum EthereumConfig `mapstructure:"ethereum"`
	Kafka    KafkaConfig    `mapstructure:"kafka"`
	Nacos    NacosConfig    `mapstructure:"nacos"`
	Metrics  MetricsConfig  `mapstructure:"metrics"`
}

type ServerConfig struct {
	Port         int           `mapstructure:"port"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
}

type EthereumConfig struct {
	WSURL              string        `mapstructure:"ws_url"`
	Network            string        `mapstructure:"network"`
	ReconnectInterval  time.Duration `mapstructure:"reconnect_interval"`
	MaxReconnectDelay  time.Duration `mapstructure:"max_reconnect_delay"`
	SubscriptionBuffer int           `mapstructure:"subscription_buffer"`
}

type KafkaConfig struct {
	Brokers         string        `mapstructure:"brokers"`
	Topic           string        `mapstructure:"topic"`
	BatchSize       int           `mapstructure:"batch_size"`
	LingerMs        int           `mapstructure:"linger_ms"`
	CompressionType string        `mapstructure:"compression_type"`
	FlushTimeout    time.Duration `mapstructure:"flush_timeout"`
}

type NacosConfig struct {
	Enabled     bool   `mapstructure:"enabled"`
	ServerAddr  string `mapstructure:"server_addr"`
	NamespaceID string `mapstructure:"namespace_id"`
	ServiceName string `mapstructure:"service_name"`
}

type MetricsConfig struct {
	Enabled bool `mapstructure:"enabled"`
	Port    int  `mapstructure:"port"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Defaults
	v.SetDefault("server.port", 9090)
	v.SetDefault("server.read_timeout", "10s")
	v.SetDefault("server.write_timeout", "10s")

	v.SetDefault("ethereum.ws_url", "ws://localhost:8546")
	v.SetDefault("ethereum.network", "ethereum")
	v.SetDefault("ethereum.reconnect_interval", "5s")
	v.SetDefault("ethereum.max_reconnect_delay", "60s")
	v.SetDefault("ethereum.subscription_buffer", 10000)

	v.SetDefault("kafka.brokers", "localhost:19092")
	v.SetDefault("kafka.topic", "mempool-pending-txs")
	v.SetDefault("kafka.batch_size", 1000)
	v.SetDefault("kafka.linger_ms", 10)
	v.SetDefault("kafka.compression_type", "lz4")
	v.SetDefault("kafka.flush_timeout", "5s")

	v.SetDefault("nacos.enabled", false)
	v.SetDefault("nacos.server_addr", "localhost:8848")
	v.SetDefault("nacos.namespace_id", "")
	v.SetDefault("nacos.service_name", "mempool-collector")

	v.SetDefault("metrics.enabled", true)
	v.SetDefault("metrics.port", 9091)

	// Environment variables
	v.SetEnvPrefix("MEMPOOL")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Config file
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath("./configs")
		v.AddConfigPath(".")
	}

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
