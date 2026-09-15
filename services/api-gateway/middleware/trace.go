package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"strings"

	"github.com/gin-gonic/gin"
)

// TraceContext preserves an upstream W3C traceparent or creates one at the API
// boundary. OpenTelemetry exporters can attach to this context without clients
// being able to choose the request identity.
func TraceContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		traceparent := c.GetHeader("traceparent")
		if !validTraceparent(traceparent) {
			traceparent = "00-" + randomHex(16) + "-" + randomHex(8) + "-01"
			c.Request.Header.Set("traceparent", traceparent)
		}
		c.Header("traceparent", traceparent)
		c.Next()
	}
}

func validTraceparent(value string) bool {
	parts := strings.Split(value, "-")
	return len(parts) == 4 && len(parts[0]) == 2 && len(parts[1]) == 32 && len(parts[2]) == 16 && len(parts[3]) == 2
}

func randomHex(size int) string {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err == nil {
		return hex.EncodeToString(bytes)
	}
	return strings.Repeat("0", size*2)
}
