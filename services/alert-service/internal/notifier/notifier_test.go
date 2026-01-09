package notifier

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/chain-risk-platform/alert-service/internal/model"
	"go.uber.org/zap"
)

func TestWebhookNotifier_Type(t *testing.T) {
	n := NewWebhookNotifier(10*time.Second, zap.NewNop())
	if n.Type() != model.ChannelTypeWebhook {
		t.Errorf("expected %s, got %s", model.ChannelTypeWebhook, n.Type())
	}
}

func TestWebhookNotifier_Send(t *testing.T) {
	logger := zap.NewNop()

	tests := []struct {
		name       string
		serverFunc func(w http.ResponseWriter, r *http.Request)
		config     model.JSONB
		wantErr    bool
	}{
		{
			name: "successful send",
			serverFunc: func(w http.ResponseWriter, r *http.Request) {
				// Verify request
				if r.Method != http.MethodPost {
					t.Errorf("expected POST, got %s", r.Method)
				}
				if r.Header.Get("Content-Type") != "application/json" {
					t.Error("expected application/json content type")
				}

				var payload WebhookPayload
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Errorf("failed to decode payload: %v", err)
				}

				if payload.Type != "test" {
					t.Errorf("expected type test, got %s", payload.Type)
				}

				w.WriteHeader(http.StatusOK)
			},
			config:  model.JSONB{"url": ""},
			wantErr: false,
		},
		{
			name: "with custom headers",
			serverFunc: func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer token123" {
					t.Error("expected Authorization header")
				}
				w.WriteHeader(http.StatusOK)
			},
			config: model.JSONB{
				"url": "",
				"headers": map[string]any{
					"Authorization": "Bearer token123",
				},
			},
			wantErr: false,
		},
		{
			name: "server error",
			serverFunc: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			},
			config:  model.JSONB{"url": ""},
			wantErr: true,
		},
		{
			name:       "missing url",
			serverFunc: nil,
			config:     model.JSONB{},
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var server *httptest.Server
			if tt.serverFunc != nil {
				server = httptest.NewServer(http.HandlerFunc(tt.serverFunc))
				defer server.Close()
				tt.config["url"] = server.URL
			}

			n := NewWebhookNotifier(10*time.Second, logger)

			alert := &model.Alert{
				Type:       "test",
				Severity:   model.SeverityLow,
				EntityType: model.EntityTypeAddress,
				EntityID:   "0x123",
				Title:      "Test Alert",
				Message:    "Test message",
			}

			err := n.Send(context.Background(), alert, tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Send() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSlackNotifier_Type(t *testing.T) {
	n := NewSlackNotifier(10*time.Second, zap.NewNop())
	if n.Type() != model.ChannelTypeSlack {
		t.Errorf("expected %s, got %s", model.ChannelTypeSlack, n.Type())
	}
}

func TestSlackNotifier_Send(t *testing.T) {
	logger := zap.NewNop()

	tests := []struct {
		name       string
		serverFunc func(w http.ResponseWriter, r *http.Request)
		config     model.JSONB
		wantErr    bool
	}{
		{
			name: "successful send",
			serverFunc: func(w http.ResponseWriter, r *http.Request) {
				var msg SlackMessage
				if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
					t.Errorf("failed to decode message: %v", err)
				}

				if len(msg.Blocks) == 0 {
					t.Error("expected blocks in message")
				}

				w.WriteHeader(http.StatusOK)
			},
			config:  model.JSONB{"webhook_url": ""},
			wantErr: false,
		},
		{
			name:       "missing webhook_url",
			serverFunc: nil,
			config:     model.JSONB{},
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var server *httptest.Server
			if tt.serverFunc != nil {
				server = httptest.NewServer(http.HandlerFunc(tt.serverFunc))
				defer server.Close()
				tt.config["webhook_url"] = server.URL
			}

			n := NewSlackNotifier(10*time.Second, logger)

			alert := &model.Alert{
				Type:       "test",
				Severity:   model.SeverityHigh,
				EntityType: model.EntityTypeAddress,
				EntityID:   "0x123456789abcdef0123456789abcdef01234567",
				Title:      "Test Alert",
				Message:    "Test message",
			}

			err := n.Send(context.Background(), alert, tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("Send() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNotifierRegistry(t *testing.T) {
	registry := NewNotifierRegistry()

	// Register notifiers
	registry.Register(NewWebhookNotifier(10*time.Second, zap.NewNop()))
	registry.Register(NewSlackNotifier(10*time.Second, zap.NewNop()))

	t.Run("get existing notifier", func(t *testing.T) {
		n, ok := registry.Get(model.ChannelTypeWebhook)
		if !ok {
			t.Error("expected to find webhook notifier")
		}
		if n == nil {
			t.Error("notifier is nil")
		}
	})

	t.Run("get non-existing notifier", func(t *testing.T) {
		_, ok := registry.Get("unknown_channel")
		if ok {
			t.Error("expected not to find unknown notifier")
		}
	})

	t.Run("supported channels", func(t *testing.T) {
		channels := registry.SupportedChannels()
		if len(channels) != 2 {
			t.Errorf("expected 2 channels, got %d", len(channels))
		}
	})
}

func TestDispatcher_Send(t *testing.T) {
	logger := zap.NewNop()
	registry := NewNotifierRegistry()

	// Setup mock server
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	registry.Register(NewWebhookNotifier(10*time.Second, logger))

	dispatcher := NewDispatcher(registry, 3, 100*time.Millisecond, logger)

	alert := &model.Alert{
		Type:       "test",
		Severity:   model.SeverityLow,
		EntityType: model.EntityTypeAddress,
		EntityID:   "0x123",
		Title:      "Test",
		Message:    "Test",
	}

	sub := &model.AlertSubscription{
		ID:          1,
		ChannelType: model.ChannelTypeWebhook,
		ChannelConfig: model.JSONB{
			"url": server.URL,
		},
		Enabled: true,
	}

	err := dispatcher.Send(context.Background(), alert, sub)
	if err != nil {
		t.Errorf("Send() error = %v", err)
	}

	if callCount != 1 {
		t.Errorf("expected 1 call, got %d", callCount)
	}
}

func TestDispatcher_Retry(t *testing.T) {
	logger := zap.NewNop()
	registry := NewNotifierRegistry()

	// Setup mock server that fails first 2 attempts
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	registry.Register(NewWebhookNotifier(10*time.Second, logger))

	dispatcher := NewDispatcher(registry, 3, 10*time.Millisecond, logger)

	alert := &model.Alert{
		Type:       "test",
		Severity:   model.SeverityLow,
		EntityType: model.EntityTypeAddress,
		EntityID:   "0x123",
		Title:      "Test",
		Message:    "Test",
	}

	sub := &model.AlertSubscription{
		ID:          1,
		ChannelType: model.ChannelTypeWebhook,
		ChannelConfig: model.JSONB{
			"url": server.URL,
		},
		Enabled: true,
	}

	err := dispatcher.Send(context.Background(), alert, sub)
	if err != nil {
		t.Errorf("Send() error = %v (expected success after retry)", err)
	}

	if callCount != 3 {
		t.Errorf("expected 3 calls (2 retries + 1 success), got %d", callCount)
	}
}

func TestDispatcher_DisabledSubscription(t *testing.T) {
	logger := zap.NewNop()
	registry := NewNotifierRegistry()
	registry.Register(NewWebhookNotifier(10*time.Second, logger))

	dispatcher := NewDispatcher(registry, 3, 10*time.Millisecond, logger)

	alert := &model.Alert{
		Type: "test",
	}

	sub := &model.AlertSubscription{
		ID:          1,
		ChannelType: model.ChannelTypeWebhook,
		Enabled:     false, // Disabled
	}

	err := dispatcher.Send(context.Background(), alert, sub)
	if err != nil {
		t.Errorf("Send() should return nil for disabled subscription, got %v", err)
	}
}
