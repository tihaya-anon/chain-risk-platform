package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Test loading with defaults (no config file)
	cfg, err := Load("")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	// Verify defaults
	if cfg.Server.Port != 9090 {
		t.Errorf("Server.Port = %d, want 9090", cfg.Server.Port)
	}
	if cfg.Server.ReadTimeout != 10*time.Second {
		t.Errorf("Server.ReadTimeout = %v, want 10s", cfg.Server.ReadTimeout)
	}

	if cfg.Ethereum.WSURL != "ws://localhost:8546" {
		t.Errorf("Ethereum.WSURL = %s, want ws://localhost:8546", cfg.Ethereum.WSURL)
	}
	if cfg.Ethereum.Network != "ethereum" {
		t.Errorf("Ethereum.Network = %s, want ethereum", cfg.Ethereum.Network)
	}
	if cfg.Ethereum.SubscriptionBuffer != 10000 {
		t.Errorf("Ethereum.SubscriptionBuffer = %d, want 10000", cfg.Ethereum.SubscriptionBuffer)
	}

	if cfg.Kafka.Brokers != "localhost:19092" {
		t.Errorf("Kafka.Brokers = %s, want localhost:19092", cfg.Kafka.Brokers)
	}
	if cfg.Kafka.Topic != "mempool-pending-txs" {
		t.Errorf("Kafka.Topic = %s, want mempool-pending-txs", cfg.Kafka.Topic)
	}

	if cfg.Metrics.Enabled != true {
		t.Error("Metrics.Enabled should be true by default")
	}
	if cfg.Metrics.Port != 9091 {
		t.Errorf("Metrics.Port = %d, want 9091", cfg.Metrics.Port)
	}
}

func TestLoad_EnvOverride(t *testing.T) {
	// Set env vars
	os.Setenv("MEMPOOL_SERVER_PORT", "8080")
	os.Setenv("MEMPOOL_ETHEREUM_WS_URL", "ws://custom:8546")
	os.Setenv("MEMPOOL_KAFKA_BROKERS", "kafka:9092")
	defer func() {
		os.Unsetenv("MEMPOOL_SERVER_PORT")
		os.Unsetenv("MEMPOOL_ETHEREUM_WS_URL")
		os.Unsetenv("MEMPOOL_KAFKA_BROKERS")
	}()

	cfg, err := Load("")
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want 8080", cfg.Server.Port)
	}
	if cfg.Ethereum.WSURL != "ws://custom:8546" {
		t.Errorf("Ethereum.WSURL = %s, want ws://custom:8546", cfg.Ethereum.WSURL)
	}
	if cfg.Kafka.Brokers != "kafka:9092" {
		t.Errorf("Kafka.Brokers = %s, want kafka:9092", cfg.Kafka.Brokers)
	}
}

func TestLoad_ConfigFile(t *testing.T) {
	// Create temp config file
	content := `
server:
  port: 7777
ethereum:
  ws_url: ws://test:8546
  network: goerli
kafka:
  brokers: test-kafka:9092
  topic: test-topic
`
	tmpFile, err := os.CreateTemp("", "config-*.yaml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(content); err != nil {
		t.Fatalf("Failed to write temp file: %v", err)
	}
	tmpFile.Close()

	cfg, err := Load(tmpFile.Name())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Server.Port != 7777 {
		t.Errorf("Server.Port = %d, want 7777", cfg.Server.Port)
	}
	if cfg.Ethereum.WSURL != "ws://test:8546" {
		t.Errorf("Ethereum.WSURL = %s, want ws://test:8546", cfg.Ethereum.WSURL)
	}
	if cfg.Ethereum.Network != "goerli" {
		t.Errorf("Ethereum.Network = %s, want goerli", cfg.Ethereum.Network)
	}
	if cfg.Kafka.Topic != "test-topic" {
		t.Errorf("Kafka.Topic = %s, want test-topic", cfg.Kafka.Topic)
	}
}

func TestLoad_InvalidConfigFile(t *testing.T) {
	// Create temp file with invalid YAML
	tmpFile, err := os.CreateTemp("", "config-*.yaml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString("invalid: yaml: content: ["); err != nil {
		t.Fatalf("Failed to write temp file: %v", err)
	}
	tmpFile.Close()

	_, err = Load(tmpFile.Name())
	if err == nil {
		t.Error("Expected error for invalid YAML")
	}
}
