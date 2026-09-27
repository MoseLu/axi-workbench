package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RequireInternalToken protects service-to-service routes that do not have a
// browser subject. It is intentionally separate from RequireIdentity: an
// outbox event is authenticated by its service credential and idempotency ID,
// not by a user session.
func RequireInternalToken(expected string) gin.HandlerFunc {
	return func(c *gin.Context) {
		supplied := strings.TrimSpace(c.GetHeader("X-Axi-Internal-Token"))
		expected = strings.TrimSpace(expected)
		if expected == "" || supplied == "" || subtle.ConstantTimeCompare([]byte(supplied), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "trusted internal credential required"})
			return
		}
		c.Next()
	}
}
