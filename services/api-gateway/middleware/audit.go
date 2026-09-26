package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// Audit emits immutable, body-free audit facts. Persisting these records is
// delegated to the platform audit contract; the gateway does not log secrets,
// OAuth codes, QR tickets, or request payloads.
func Audit(logger zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()
		event := logger.Info().
			Str("event", "gateway.audit").
			Str("request_id", c.GetString("request_id")).
			Str("traceparent", c.GetHeader("traceparent")).
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(started))
		if principal, ok := PrincipalFromContext(c); ok {
			event = event.Str("subject", principal.Subject)
		}
		if tenantID := c.Param("tenantID"); tenantID != "" {
			event = event.Str("tenant_id", tenantID)
		}
		event.Msg("request completed")
	}
}
