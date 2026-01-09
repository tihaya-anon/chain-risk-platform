package nacos

import (
	"fmt"
	"time"

	"github.com/nacos-group/nacos-sdk-go/v2/clients"
	"github.com/nacos-group/nacos-sdk-go/v2/clients/config_client"
	"github.com/nacos-group/nacos-sdk-go/v2/common/constant"
	"github.com/nacos-group/nacos-sdk-go/v2/vo"
	"go.uber.org/zap"
)

// Config holds Nacos client configuration
type Config struct {
	ServerAddr string
	Namespace  string
	Group      string
	DataID     string
	Timeout    time.Duration
}

// Client wraps Nacos config client
type Client struct {
	configClient config_client.IConfigClient
	config       Config
	logger       *zap.Logger
}

// NewClient creates a new Nacos client
func NewClient(cfg Config, logger *zap.Logger) (*Client, error) {
	// Parse server address
	host, port := parseServerAddr(cfg.ServerAddr)

	// Server config
	sc := []constant.ServerConfig{
		{
			IpAddr: host,
			Port:   uint64(port),
		},
	}

	// Client config
	cc := constant.ClientConfig{
		NamespaceId:         cfg.Namespace,
		TimeoutMs:           uint64(cfg.Timeout.Milliseconds()),
		NotLoadCacheAtStart: true,
		LogLevel:            "warn",
	}

	// Create config client
	configClient, err := clients.NewConfigClient(
		vo.NacosClientParam{
			ClientConfig:  &cc,
			ServerConfigs: sc,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("create nacos client: %w", err)
	}

	return &Client{
		configClient: configClient,
		config:       cfg,
		logger:       logger,
	}, nil
}

// GetConfig retrieves configuration from Nacos
func (c *Client) GetConfig() (string, error) {
	content, err := c.configClient.GetConfig(vo.ConfigParam{
		DataId: c.config.DataID,
		Group:  c.config.Group,
	})
	if err != nil {
		return "", fmt.Errorf("get config: %w", err)
	}

	return content, nil
}

// ListenConfig registers a listener for config changes
func (c *Client) ListenConfig(onChange func(namespace, group, dataId, data string)) error {
	return c.configClient.ListenConfig(vo.ConfigParam{
		DataId: c.config.DataID,
		Group:  c.config.Group,
		OnChange: func(namespace, group, dataId, data string) {
			c.logger.Info("Config changed",
				zap.String("namespace", namespace),
				zap.String("group", group),
				zap.String("dataId", dataId))
			onChange(namespace, group, dataId, data)
		},
	})
}

// parseServerAddr parses server address into host and port
func parseServerAddr(addr string) (string, int) {
	// Default values
	host := "localhost"
	port := 8848

	// Simple parsing (format: host:port)
	var h string
	var p int
	n, _ := fmt.Sscanf(addr, "%s:%d", &h, &p)
	if n >= 1 {
		host = h
	}
	if n >= 2 {
		port = p
	}

	return host, port
}
