package collector

import (
	"context"
	"testing"
	"time"

	"github.com/chain-risk-platform/mempool-collector/internal/config"
	"go.uber.org/zap"
)

func TestNewCollector(t *testing.T) {
	cfg := &config.EthereumConfig{
		WSURL:              "ws://localhost:8546",
		Network:            "ethereum",
		ReconnectInterval:  5 * time.Second,
		MaxReconnectDelay:  60 * time.Second,
		SubscriptionBuffer: 1000,
	}
	logger := zap.NewNop()
	metrics := NewMetrics("test")

	collector := NewCollector(cfg, logger, metrics)

	if collector == nil {
		t.Fatal("NewCollector returned nil")
	}

	// Check initial state
	if collector.IsConnected() {
		t.Error("Collector should not be connected initially")
	}

	// Check channel is created
	ch := collector.TxChannel()
	if ch == nil {
		t.Error("TxChannel returned nil")
	}
}

func TestCollector_IsConnected(t *testing.T) {
	cfg := &config.EthereumConfig{
		SubscriptionBuffer: 100,
	}
	collector := NewCollector(cfg, zap.NewNop(), NewMetrics("test_conn"))

	// Initially not connected
	if collector.IsConnected() {
		t.Error("Should not be connected initially")
	}

	// Simulate connection state change
	collector.setConnected(true)
	if !collector.IsConnected() {
		t.Error("Should be connected after setConnected(true)")
	}

	collector.setConnected(false)
	if collector.IsConnected() {
		t.Error("Should not be connected after setConnected(false)")
	}
}

func TestCollector_Stop(t *testing.T) {
	cfg := &config.EthereumConfig{
		SubscriptionBuffer: 100,
	}
	collector := NewCollector(cfg, zap.NewNop(), NewMetrics("test_stop"))

	// Start collector briefly
	ctx, cancel := context.WithCancel(context.Background())
	go collector.Start(ctx)

	// Give it time to start
	time.Sleep(10 * time.Millisecond)

	// Stop should not panic
	cancel()
	collector.Stop()
}

func TestCollector_TxChannel_Capacity(t *testing.T) {
	bufferSize := 500
	cfg := &config.EthereumConfig{
		SubscriptionBuffer: bufferSize,
	}
	collector := NewCollector(cfg, zap.NewNop(), NewMetrics("test_cap"))

	ch := collector.TxChannel()
	if cap(ch) != bufferSize {
		t.Errorf("Channel capacity = %d, want %d", cap(ch), bufferSize)
	}
}
