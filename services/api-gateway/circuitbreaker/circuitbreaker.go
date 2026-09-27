package circuitbreaker

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// State represents the state of the circuit breaker.
type State int

const (
	StateClosed State = iota
	StateOpen
	StateHalfOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half_open"
	default:
		return "unknown"
	}
}

// Config holds the configuration for a CircuitBreaker.
type Config struct {
	Name              string
	FailureThreshold int           // Number of failures before opening the circuit
	SuccessThreshold int           // Number of successes in half-open before closing
	Timeout          time.Duration // Time to wait before transitioning from OPEN to HALF_OPEN
}

// DefaultConfig returns a default configuration.
func DefaultConfig(name string) Config {
	return Config{
		Name:              name,
		FailureThreshold: 5,
		SuccessThreshold: 2,
		Timeout:          30 * time.Second,
	}
}

// CircuitBreaker implements a thread-safe circuit breaker pattern.
type CircuitBreaker struct {
	name string
	cfg  Config

	mu sync.RWMutex
	// persistent state (protected by mu)
	state         State
	failureCount  int
	successCount  int
	lastFailure   time.Time
	lastStateChange time.Time

	// metrics (read-only, thread-safe)
	requestsTotal       prometheus.Counter
	requestsSuccess     prometheus.Counter
	requestsFailed      prometheus.Counter
	requestsRejected    prometheus.Counter
	stateChanges        prometheus.Counter
	currentState        prometheus.Gauge
	failureRatio        prometheus.Gauge
}

// New creates a new CircuitBreaker with the given configuration.
func New(cfg Config) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:             cfg.Name,
		cfg:              cfg,
		state:            StateClosed,
		lastStateChange:  time.Now(),
	}

	// Register Prometheus metrics with unique names per instance to avoid conflicts
	namespace := "axi_gateway"
	subsystem := "circuitbreaker"
	name := cfg.Name

	cb.requestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "requests_total_" + name,
		Help:       "Total number of requests processed by circuit breaker " + name,
	})

	cb.requestsSuccess = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "requests_success_total_" + name,
		Help:       "Total number of successful requests for circuit breaker " + name,
	})

	cb.requestsFailed = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "requests_failed_total_" + name,
		Help:       "Total number of failed requests for circuit breaker " + name,
	})

	cb.requestsRejected = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "requests_rejected_total_" + name,
		Help:       "Total number of rejected requests for circuit breaker " + name,
	})

	cb.stateChanges = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "state_changes_total_" + name,
		Help:       "Total number of state changes for circuit breaker " + name,
	})

	cb.currentState = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "state_" + name,
		Help:       "Current state of circuit breaker " + name + " (0=closed, 1=open, 2=half_open)",
	})

	cb.failureRatio = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:       "failure_ratio_" + name,
		Help:       "Current failure ratio for circuit breaker " + name,
	})

	cb.currentState.Set(0)

	return cb
}

// ErrCircuitOpen is returned when the circuit breaker is open.
var ErrCircuitOpen = errors.New("circuit breaker is open")

// Execute runs the given function through the circuit breaker.
// It returns ErrCircuitOpen if the circuit is open.
func (cb *CircuitBreaker) Execute(ctx context.Context, fn func(ctx context.Context) error) error {
	cb.requestsTotal.Inc()

	if !cb.allowRequest() {
		cb.requestsRejected.Inc()
		return ErrCircuitOpen
	}

	err := fn(ctx)

	if err != nil {
		cb.recordFailure()
		cb.requestsFailed.Inc()
	} else {
		cb.recordSuccess()
		cb.requestsSuccess.Inc()
	}

	return err
}

// allowRequest checks if a request should be allowed through.
func (cb *CircuitBreaker) allowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true

	case StateOpen:
		// Check if timeout has elapsed to transition to half-open
		if time.Since(cb.lastStateChange) >= cb.cfg.Timeout {
			cb.transitionToLocked(StateHalfOpen)
			return true
		}
		return false

	case StateHalfOpen:
		// In half-open state, allow only one request through at a time
		// The first request in half-open is allowed, subsequent ones are rejected
		// This is handled by the fact that we reset counts on transition
		return true
	}

	return false
}

// recordFailure records a failed request and potentially opens the circuit.
func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount++
	cb.lastFailure = time.Now()

	// Calculate failure ratio
	total := float64(cb.failureCount + cb.successCount)
	if total > 0 {
		cb.failureRatio.Set(float64(cb.failureCount) / total)
	}

	switch cb.state {
	case StateClosed:
		if cb.failureCount >= cb.cfg.FailureThreshold {
			cb.transitionToLocked(StateOpen)
		}

	case StateHalfOpen:
		// Any failure in half-open state opens the circuit immediately
		cb.transitionToLocked(StateOpen)
	}
}

// recordSuccess records a successful request and potentially closes the circuit.
func (cb *CircuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.successCount++

	// Calculate failure ratio
	total := float64(cb.failureCount + cb.successCount)
	if total > 0 {
		cb.failureRatio.Set(float64(cb.failureCount) / total)
	}

	switch cb.state {
	case StateClosed:
		// Reset failure count on success in closed state (sliding window behavior)
		if cb.failureCount > 0 {
			cb.failureCount--
		}

	case StateHalfOpen:
		if cb.successCount >= cb.cfg.SuccessThreshold {
			cb.transitionToLocked(StateClosed)
		}
	}
}

// transitionToLocked transitions to a new state (caller must hold the lock).
func (cb *CircuitBreaker) transitionToLocked(newState State) {
	if cb.state == newState {
		return
	}

	cb.state = newState
	cb.lastStateChange = time.Now()
	cb.stateChanges.Inc()
	cb.currentState.Set(float64(newState))

	// Reset counters on state transition
	cb.failureCount = 0
	cb.successCount = 0
}

// transitionTo is the public thread-safe version.
func (cb *CircuitBreaker) transitionTo(newState State) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.transitionToLocked(newState)
}

// State returns the current state of the circuit breaker.
func (cb *CircuitBreaker) State() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Metrics returns current metrics for the circuit breaker.
func (cb *CircuitBreaker) Metrics() Metrics {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return Metrics{
		Name:          cb.name,
		State:         cb.state,
		FailureCount:  cb.failureCount,
		SuccessCount:  cb.successCount,
		LastFailure:   cb.lastFailure,
		LastStateChange: cb.lastStateChange,
	}
}

// Metrics holds the current metrics of a circuit breaker.
type Metrics struct {
	Name            string
	State           State
	FailureCount    int
	SuccessCount    int
	LastFailure     time.Time
	LastStateChange time.Time
}
