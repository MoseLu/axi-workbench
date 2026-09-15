package middleware

import (
	"context"
	"net/http"

	"github.com/epap/api-gateway/circuitbreaker"
	"github.com/gin-gonic/gin"
)

// CircuitBreaker provides a Gin middleware that wraps requests through a circuit breaker.
func CircuitBreaker(cb *circuitbreaker.CircuitBreaker, target string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Execute the request through the circuit breaker
		err := cb.Execute(c.Request.Context(), func(ctx context.Context) error {
			// Store context in the Gin context for downstream use
			c.Request = c.Request.WithContext(ctx)
			c.Next()

			// Check if the handler encountered an error
			if len(c.Errors) > 0 {
				// Return the first error if any
				return c.Errors.Last().Err
			}

			// If response status indicates server error (5xx), treat as failure
			if c.Writer.Status() >= 500 {
				return &circuitOpenError{status: c.Writer.Status(), path: c.Request.URL.Path}
			}

			return nil
		})

		// Handle circuit breaker rejection
		if err != nil {
			if err == circuitbreaker.ErrCircuitOpen {
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"error":   "service temporarily unavailable",
					"message": "circuit breaker is open",
					"target":  target,
				})
				return
			}

			// For other errors, check if headers were already sent
			if c.Writer.Written() {
				return
			}

			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error":   "circuit breaker execution error",
				"message": err.Error(),
				"target":  target,
			})
			return
		}
	}
}

// circuitOpenError is used to signal a circuit-breaking error.
type circuitOpenError struct {
	status int
	path   string
}

func (e *circuitOpenError) Error() string {
	return "circuit breaker triggered by upstream error"
}

// IsCircuitOpenError checks if an error is a circuit open error.
func IsCircuitOpenError(err error) bool {
	_, ok := err.(*circuitOpenError)
	return ok
}
