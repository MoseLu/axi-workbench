package discovery

import (
	"context"
	"log/slog"
)

// Manager coordinates service discovery across the gateway.
// It wraps the Resolver and provides a simpler interface.
type Manager struct {
	resolver *Resolver
	logger   *slog.Logger
}

// NewManager creates a new discovery manager.
func NewManager(logger *slog.Logger) *Manager {
	return &Manager{
		resolver: NewResolver(),
		logger:   logger,
	}
}

// GetAddress returns a single address for the given service using round-robin.
func (m *Manager) GetAddress(ctx context.Context, service string) (string, error) {
	return m.resolver.GetAddress(ctx, service)
}

// GetAddresses returns all addresses for the given service.
func (m *Manager) GetAddresses(ctx context.Context, service string) ([]string, error) {
	return m.resolver.GetAddresses(ctx, service)
}

// RegisterUpstream registers an upstream service for discovery.
func (m *Manager) RegisterUpstream(cfg UpstreamConfig) {
	m.resolver.RegisterUpstream(cfg)
	m.logger.Info("registered upstream for service discovery",
		slog.String("upstream", cfg.Name),
		slog.String("discovery", cfg.Discovery),
		slog.String("url", cfg.URL),
	)
}

// Resolver returns the underlying resolver.
func (m *Manager) Resolver() *Resolver {
	return m.resolver
}
