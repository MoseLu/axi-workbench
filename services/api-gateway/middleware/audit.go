package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// Audit emits immutable, body-free audit facts. Persisting these
// records is delegated to the platform audit contract; the gateway
// does not log secrets, OAuth codes, QR tickets, or request payloads.
func Audit(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()

		attrs := []any{
			slog.String("event", "gateway.audit"),
			slog.String("request_id", c.GetString("request_id")),
			slog.String("traceparent", c.GetHeader("traceparent")),
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(started)),
		}
		if principal, ok := PrincipalFromContext(c); ok {
			attrs = append(attrs, slog.String("subject", principal.Subject))
		}
		if tenantID := c.Param("tenantID"); tenantID != "" {
			attrs = append(attrs, slog.String("tenant_id", tenantID))
		}
		logger.Info("request completed", attrs...)
	}
}
