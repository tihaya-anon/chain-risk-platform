package nacos

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/nacos-group/nacos-sdk-go/v2/clients"
	"github.com/nacos-group/nacos-sdk-go/v2/clients/config_client"
	"github.com/nacos-group/nacos-sdk-go/v2/clients/naming_client"
	"github.com/nacos-group/nacos-sdk-go/v2/common/constant"
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
		} `yaml:"ingestion"`
	} `yaml:"pipeline"`
	Alert struct {
		DedupWindowSeconds int `yaml:"dedupWindowSeconds"`
		RetryAttempts      int `yaml:"retryAttempts"`
	} `yaml:"alert"`
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
	Username    string
	Password    string
	ServiceName string
	ServiceIP   string
	ServicePort uint64
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

	// Client config
	cc := constant.ClientConfig{
		NamespaceId:         cfg.NamespaceID,
		TimeoutMs:           5000,
		NotLoadCacheAtStart: true,
		LogDir:              "/tmp/nacos/log",
		CacheDir:            "/tmp/nacos/cache",
		LogLevel:            "warn",
	}

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
		zap.Bool("pipelineEnabled", newConfig.Pipeline.Enabled))

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

// Close closes the Nacos client
func (c *Client) Close() {
	if err := c.DeregisterService(); err != nil {
		c.logger.Error("Failed to deregister service", zap.Error(err))
	}
}

// ParseServerAddr parses NACOS_SERVER env into host and port
func ParseServerAddr(addr string) (string, uint64) {
	var serverAddr string
	var serverPort uint64 = 18848

	parts := strings.Split(addr, ":")
	serverAddr = parts[0]
	if len(parts) > 1 {
		if p, err := strconv.ParseUint(parts[1], 10, 64); err == nil {
			serverPort = p
		}
	}

	return serverAddr, serverPort
}
