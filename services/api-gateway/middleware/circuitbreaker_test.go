package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/epap/api-gateway/circuitbreaker"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCircuitBreakerMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cfg := circuitbreaker.Config{
		Name:              "test-middleware-2",
		FailureThreshold:  3,
		SuccessThreshold:  2,
		Timeout:           50 * time.Millisecond,
	}
	cb := circuitbreaker.New(cfg)

	t.Run("allows requests when circuit is closed", func(t *testing.T) {
		router := gin.New()
		router.Use(CircuitBreaker(cb, "test-service"))
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("rejects requests when circuit is open", func(t *testing.T) {
		// Open the circuit
		for i := 0; i < 3; i++ {
			cb.Execute(context.Background(), func(ctx context.Context) error {
				return errors.New("error")
			})
		}
		require.Equal(t, circuitbreaker.StateOpen, cb.State())

		router := gin.New()
		router.Use(CircuitBreaker(cb, "test-service"))
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	})

	t.Run("allows requests after timeout", func(t *testing.T) {
		// Open the circuit
		for i := 0; i < 3; i++ {
			cb.Execute(context.Background(), func(ctx context.Context) error {
				return errors.New("error")
			})
		}
		require.Equal(t, circuitbreaker.StateOpen, cb.State())

		// Wait for timeout
		time.Sleep(75 * time.Millisecond)

		router := gin.New()
		router.Use(CircuitBreaker(cb, "test-service"))
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, circuitbreaker.StateHalfOpen, cb.State())
	})
}

func TestIsCircuitOpenError(t *testing.T) {
	assert.False(t, IsCircuitOpenError(errors.New("normal error")))
	assert.False(t, IsCircuitOpenError(nil))
	assert.True(t, IsCircuitOpenError(&circuitOpenError{}))
}
