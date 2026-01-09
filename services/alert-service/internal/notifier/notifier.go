package notifier

import (
	"context"
	"sync"

	"github.com/chain-risk-platform/alert-service/internal/model"
)

// Notifier sends alert notifications via a specific channel
type Notifier interface {
	// Type returns the channel type
	Type() string

	// Send sends an alert notification
	Send(ctx context.Context, alert *model.Alert, config model.JSONB) error
}

// NotifierRegistry manages all notifiers
type NotifierRegistry struct {
	mu        sync.RWMutex
	notifiers map[string]Notifier
}

// NewNotifierRegistry creates a new notifier registry
func NewNotifierRegistry() *NotifierRegistry {
	return &NotifierRegistry{
		notifiers: make(map[string]Notifier),
	}
}

// Register adds a notifier to the registry
func (r *NotifierRegistry) Register(n Notifier) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifiers[n.Type()] = n
}

// Get returns a notifier by channel type
func (r *NotifierRegistry) Get(channelType string) (Notifier, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n, ok := r.notifiers[channelType]
	return n, ok
}

// SupportedChannels returns all registered channel types
func (r *NotifierRegistry) SupportedChannels() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.notifiers))
	for t := range r.notifiers {
		types = append(types, t)
	}
	return types
}
