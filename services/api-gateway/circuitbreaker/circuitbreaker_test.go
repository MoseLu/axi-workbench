package circuitbreaker

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cfg := Config{
		Name:              "test-state-transitions",
		FailureThreshold:  3,
		SuccessThreshold:  2,
		Timeout:           50 * time.Millisecond,
	}
	cb := New(cfg)

	// Initial state should be closed
	assert.Equal(t, StateClosed, cb.State())

	// Record 2 failures - should still be closed
	for i := 0; i < 2; i++ {
		err := cb.Execute(context.Background(), func(ctx context.Context) error {
			return errors.New("test error")
		})
		assert.Error(t, err)
	}
	assert.Equal(t, StateClosed, cb.State())

	// Record 3rd failure - should open
	err := cb.Execute(context.Background(), func(ctx context.Context) error {
		return errors.New("test error")
	})
	assert.Error(t, err)
	assert.Equal(t, StateOpen, cb.State())

	// Requests should be rejected immediately when open
	for i := 0; i < 5; i++ {
		err := cb.Execute(context.Background(), func(ctx context.Context) error {
			t.Error("request should not reach here")
			return nil
		})
		assert.ErrorIs(t, err, ErrCircuitOpen)
	}
	assert.Equal(t, StateOpen, cb.State())

	// Wait for timeout
	time.Sleep(75 * time.Millisecond)

	// Next request should transition to half-open
	err = cb.Execute(context.Background(), func(ctx context.Context) error {
		return nil // success
	})
	assert.NoError(t, err)
	assert.Equal(t, StateHalfOpen, cb.State())

	// Second success should close the circuit
	err = cb.Execute(context.Background(), func(ctx context.Context) error {
		return nil
	})
	assert.NoError(t, err)
	assert.Equal(t, StateClosed, cb.State())
}

func TestCircuitBreaker_HalfOpenFailure(t *testing.T) {
	cfg := Config{
		Name:              "test-half-open-failure",
		FailureThreshold:  3,
		SuccessThreshold:  2,
		Timeout:           50 * time.Millisecond,
	}
	cb := New(cfg)

	// Open the circuit
	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errors.New("test error")
		})
	}
	require.Equal(t, StateOpen, cb.State())

	// Wait for timeout
	time.Sleep(150 * time.Millisecond)

	// Transition to half-open with first request
	err := cb.Execute(context.Background(), func(ctx context.Context) error {
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, StateHalfOpen, cb.State())

	// Failure in half-open should immediately open
	err = cb.Execute(context.Background(), func(ctx context.Context) error {
		return errors.New("half-open error")
	})
	assert.Error(t, err)
	assert.Equal(t, StateOpen, cb.State())

	// Should be open again
	err = cb.Execute(context.Background(), func(ctx context.Context) error {
		t.Error("should not reach here")
		return nil
	})
	assert.ErrorIs(t, err, ErrCircuitOpen)
}

func TestCircuitBreaker_Concurrency(t *testing.T) {
	cfg := Config{
		Name:              "test-concurrent",
		FailureThreshold:  10,
		SuccessThreshold:  3,
		Timeout:           50 * time.Millisecond,
	}
	cb := New(cfg)

	var wg sync.WaitGroup
	start := make(chan struct{})

	// Launch 100 concurrent requests
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			cb.Execute(context.Background(), func(ctx context.Context) error {
				time.Sleep(time.Microsecond)
				return nil
			})
		}()
	}

	close(start)
	wg.Wait()

	// All should complete without panic
	metrics := cb.Metrics()
	t.Logf("Final state: %s, failures: %d, successes: %d",
		metrics.State, metrics.FailureCount, metrics.SuccessCount)
}

func TestCircuitBreaker_Metrics(t *testing.T) {
	cfg := Config{
		Name:              "test-metrics-2",
		FailureThreshold:  5,
		SuccessThreshold:  2,
		Timeout:           1 * time.Hour, // Prevent auto-transition
	}
	cb := New(cfg)

	// Record some successes
	for i := 0; i < 5; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return nil
		})
	}

	// Record some failures
	for i := 0; i < 3; i++ {
		cb.Execute(context.Background(), func(ctx context.Context) error {
			return errors.New("error")
		})
	}

	metrics := cb.Metrics()
	assert.Equal(t, "test-metrics-2", metrics.Name)
	assert.Equal(t, StateClosed, metrics.State)
	assert.Equal(t, 3, metrics.FailureCount)
	assert.Equal(t, 5, metrics.SuccessCount)
}

func TestCircuitBreaker_StateStrings(t *testing.T) {
	assert.Equal(t, "closed", StateClosed.String())
	assert.Equal(t, "open", StateOpen.String())
	assert.Equal(t, "half_open", StateHalfOpen.String())
	assert.Equal(t, "unknown", State(99).String())
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig("test")
	assert.Equal(t, "test", cfg.Name)
	assert.Equal(t, 5, cfg.FailureThreshold)
	assert.Equal(t, 2, cfg.SuccessThreshold)
	assert.Equal(t, 30*time.Second, cfg.Timeout)
}
