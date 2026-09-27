package circuitbreaker

import (
	"context"
	"log/slog"
	"sync"
)

// Manager manages circuit breakers for multiple services.
type Manager struct {
	breakers map[string]*CircuitBreaker
	mu       sync.RWMutex
	logger   *slog.Logger
}

// NewManager creates a new circuit breaker manager.
func NewManager(logger *slog.Logger) *Manager {
	return &Manager{
		breakers: make(map[string]*CircuitBreaker),
		logger:   logger,
	}
}

// GetOrCreate returns an existing circuit breaker or creates a new one.
func (m *Manager) GetOrCreate(name string, cfg Config) *CircuitBreaker {
	m.mu.RLock()
	cb, exists := m.breakers[name]
	m.mu.RUnlock()

	if exists {
		return cb
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if cb, exists = m.breakers[name]; exists {
		return cb
	}

	cb = New(cfg)
	m.breakers[name] = cb
	m.logger.Info("circuit breaker created",
		slog.String("service", name),
		slog.Int("failure_threshold", cfg.FailureThreshold),
		slog.Int("success_threshold", cfg.SuccessThreshold),
		slog.Duration("timeout", cfg.Timeout),
	)

	return cb
}

// Get returns an existing circuit breaker or nil if not found.
func (m *Manager) Get(name string) *CircuitBreaker {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.breakers[name]
}

// CircuitBreakerFunc is a function that performs an operation protected by a circuit breaker.
type CircuitBreakerFunc func(ctx context.Context) error

// ExecuteWithCircuitBreaker runs a function with circuit breaker protection.
func ExecuteWithCircuitBreaker(ctx context.Context, cb *CircuitBreaker, fn CircuitBreakerFunc) error {
	return cb.Execute(ctx, fn)
}
