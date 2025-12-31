package nacos

import (
	"fmt"
	"sync"

	"github.com/nacos-group/nacos-sdk-go/v2/clients"
	"github.com/nacos-group/nacos-sdk-go/v2/clients/config_client"
	"github.com/nacos-group/nacos-sdk-go/v2/clients/naming_client"
	"github.com/nacos-group/nacos-sdk-go/v2/common/constant"
	"github.com/nacos-group/nacos-sdk-go/v2/model"
	"github.com/nacos-group/nacos-sdk-go/v2/vo"
	"go.uber.org/zap"
	"gopkg.in/yaml.v3"
)

// PipelineConfig represents the shared pipeline configuration from Nacos
type PipelineConfig struct {
	Pipeline struct {
		Enabled   bool `yaml:"enabled"`
		Ingestion struct {
			Enabled bool   `yaml:"enabled"`
			Network string `yaml:"network"`
			Polling struct {
				IntervalMs    int `yaml:"intervalMs"`
				BatchSize     int `yaml:"batchSize"`
				Confirmations int `yaml:"confirmations"`
			} `yaml:"polling"`
			RateLimit struct {
				RequestsPerSecond int `yaml:"requestsPerSecond"`
			} `yaml:"rateLimit"`
		} `yaml:"ingestion"`
		StreamProcessor struct {
			Enabled     bool `yaml:"enabled"`
			Parallelism int  `yaml:"parallelism"`
		} `yaml:"stream-processor"`
		GraphSync struct {
			Enabled    bool  `yaml:"enabled"`
			IntervalMs int64 `yaml:"intervalMs"`
			BatchSize  int   `yaml:"batchSize"`
		} `yaml:"graph-sync"`
	} `yaml:"pipeline"`
	Risk struct {
		HighThreshold   float64 `yaml:"highThreshold"`
		MediumThreshold float64 `yaml:"mediumThreshold"`
		CacheTtlSeconds int     `yaml:"cacheTtlSeconds"`
	} `yaml:"risk"`
}

// Client wraps Nacos config and naming clients
type Client struct {
	configClient config_client.IConfigClient
	namingClient naming_client.INamingClient
	logger       *zap.Logger

	// Current configuration
	config   *PipelineConfig
	configMu sync.RWMutex

	// Configuration change listeners
	listeners  []func(*PipelineConfig)
	listenerMu sync.Mutex

	// Service info for registration
	serviceName string
	serviceIP   string
	servicePort uint64
}

// Config holds Nacos connection configuration
type Config struct {
	ServerAddr  string
	ServerPort  uint64
	NamespaceID string
	// Authentication (required if Nacos auth is enabled)
	Username string
	Password string
	// Service registration info
	ServiceName string
	ServiceIP   string
	ServicePort uint64
	Metadata    map[string]string
}

// NewClient creates a new Nacos client
func NewClient(cfg *Config, logger *zap.Logger) (*Client, error) {
	// Server config
	sc := []constant.ServerConfig{
		{
			IpAddr: cfg.ServerAddr,
			Port:   cfg.ServerPort,
		},
	}

	// Note: Only set Username/Password if Nacos server has auth enabled
	// When auth is disabled, setting these causes login errors
	cc := constant.ClientConfig{
		NamespaceId:         cfg.NamespaceID,
		TimeoutMs:           5000,
		NotLoadCacheAtStart: true,
		LogDir:              "/tmp/nacos/log",
		CacheDir:            "/tmp/nacos/cache",
		LogLevel:            "warn",
	}

	// Only set auth credentials if both username and password are provided
	if cfg.Username != "" && cfg.Password != "" {
		cc.Username = cfg.Username
		cc.Password = cfg.Password
	}

	// Create config client
	configClient, err := clients.NewConfigClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("create config client: %w", err)
	}

	// Create naming client
	namingClient, err := clients.NewNamingClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("create naming client: %w", err)
	}

	client := &Client{
		configClient: configClient,
		namingClient: namingClient,
		logger:       logger,
		config:       &PipelineConfig{},
		listeners:    make([]func(*PipelineConfig), 0),
		serviceName:  cfg.ServiceName,
		serviceIP:    cfg.ServiceIP,
		servicePort:  cfg.ServicePort,
	}

	// Load initial configuration
	if err := client.loadConfig(); err != nil {
		logger.Warn("Failed to load initial config from Nacos, using defaults", zap.Error(err))
	}

	// Start watching for config changes
	client.watchConfig()

	return client, nil
}

// loadConfig loads configuration from Nacos
func (c *Client) loadConfig() error {
	content, err := c.configClient.GetConfig(vo.ConfigParam{
		DataId: "chain-risk-pipeline.yaml",
		Group:  "DEFAULT_GROUP",
	})
	if err != nil {
		return fmt.Errorf("get config: %w", err)
	}

	return c.parseConfig(content)
}

// parseConfig parses YAML configuration
func (c *Client) parseConfig(content string) error {
	c.configMu.Lock()
	defer c.configMu.Unlock()

	newConfig := &PipelineConfig{}
	if err := yaml.Unmarshal([]byte(content), newConfig); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	c.config = newConfig
	c.logger.Info("Configuration updated from Nacos",
		zap.Bool("pipelineEnabled", newConfig.Pipeline.Enabled),
		zap.Bool("ingestionEnabled", newConfig.Pipeline.Ingestion.Enabled),
		zap.Int("batchSize", newConfig.Pipeline.Ingestion.Polling.BatchSize))

	// Notify listeners
	c.notifyListeners(newConfig)

	return nil
}

// watchConfig starts watching for configuration changes
func (c *Client) watchConfig() {
	err := c.configClient.ListenConfig(vo.ConfigParam{
		DataId: "chain-risk-pipeline.yaml",
		Group:  "DEFAULT_GROUP",
		OnChange: func(namespace, group, dataId, data string) {
			c.logger.Info("Configuration changed in Nacos, reloading...")
			if err := c.parseConfig(data); err != nil {
				c.logger.Error("Failed to parse updated config", zap.Error(err))
			}
		},
	})
	if err != nil {
		c.logger.Error("Failed to listen for config changes", zap.Error(err))
	}
}

// GetConfig returns the current configuration
func (c *Client) GetConfig() *PipelineConfig {
	c.configMu.RLock()
	defer c.configMu.RUnlock()
	return c.config
}

// OnConfigChange registers a callback for configuration changes
func (c *Client) OnConfigChange(listener func(*PipelineConfig)) {
	c.listenerMu.Lock()
	defer c.listenerMu.Unlock()
	c.listeners = append(c.listeners, listener)
}

// notifyListeners notifies all registered listeners
func (c *Client) notifyListeners(config *PipelineConfig) {
	c.listenerMu.Lock()
	defer c.listenerMu.Unlock()
	for _, listener := range c.listeners {
		go listener(config)
	}
}

// RegisterService registers the service with Nacos
func (c *Client) RegisterService(metadata map[string]string) error {
	success, err := c.namingClient.RegisterInstance(vo.RegisterInstanceParam{
		Ip:          c.serviceIP,
		Port:        c.servicePort,
		ServiceName: c.serviceName,
		Weight:      10,
		Enable:      true,
		Healthy:     true,
		Ephemeral:   true,
		Metadata:    metadata,
		GroupName:   "DEFAULT_GROUP",
	})
	if err != nil {
		return fmt.Errorf("register instance: %w", err)
	}
	if !success {
		return fmt.Errorf("register instance failed")
	}

	c.logger.Info("Service registered with Nacos",
		zap.String("serviceName", c.serviceName),
		zap.String("ip", c.serviceIP),
		zap.Uint64("port", c.servicePort))

	return nil
}

// DeregisterService deregisters the service from Nacos
func (c *Client) DeregisterService() error {
	success, err := c.namingClient.DeregisterInstance(vo.DeregisterInstanceParam{
		Ip:          c.serviceIP,
		Port:        c.servicePort,
		ServiceName: c.serviceName,
		GroupName:   "DEFAULT_GROUP",
		Ephemeral:   true,
	})
	if err != nil {
		return fmt.Errorf("deregister instance: %w", err)
	}
	if !success {
		return fmt.Errorf("deregister instance failed")
	}

	c.logger.Info("Service deregistered from Nacos")
	return nil
}

// GetService gets instances of a service
func (c *Client) GetService(serviceName string) ([]model.Instance, error) {
	instances, err := c.namingClient.SelectInstances(vo.SelectInstancesParam{
		ServiceName: serviceName,
		GroupName:   "DEFAULT_GROUP",
		HealthyOnly: true,
	})
	if err != nil {
		return nil, fmt.Errorf("select instances: %w", err)
	}

	return instances, nil
}

// IsIngestionEnabled checks if ingestion is enabled via Nacos config
func (c *Client) IsIngestionEnabled() bool {
	config := c.GetConfig()
	return config.Pipeline.Enabled && config.Pipeline.Ingestion.Enabled
}

// GetIngestionBatchSize returns the batch size from Nacos config
func (c *Client) GetIngestionBatchSize() int {
	config := c.GetConfig()
	if config.Pipeline.Ingestion.Polling.BatchSize > 0 {
		return config.Pipeline.Ingestion.Polling.BatchSize
	}
	return 10 // default
}

// GetIngestionIntervalMs returns the polling interval from Nacos config
func (c *Client) GetIngestionIntervalMs() int {
	config := c.GetConfig()
	if config.Pipeline.Ingestion.Polling.IntervalMs > 0 {
		return config.Pipeline.Ingestion.Polling.IntervalMs
	}
	return 12000 // default
}

// Close closes the Nacos client
func (c *Client) Close() {
	// Deregister service
	if err := c.DeregisterService(); err != nil {
		c.logger.Error("Failed to deregister service", zap.Error(err))
	}
}
