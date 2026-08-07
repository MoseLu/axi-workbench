package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"notification-service/config"
)

const subjectKey = "axi.subject"

// RequireGatewayIdentity accepts only the credential injected by api-gateway.
// The gateway has already validated OIDC; this service never trusts browser
// Authorization headers or userId query parameters as identity.
func RequireGatewayIdentity(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		supplied := strings.TrimSpace(c.GetHeader("X-Axi-Internal-Token"))
		expected := strings.TrimSpace(cfg.InternalServiceToken)
		subject := strings.TrimSpace(c.GetHeader("X-Axi-Subject"))
		if expected == "" || supplied == "" || subtle.ConstantTimeCompare([]byte(supplied), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "trusted gateway credential required"})
			return
		}
		if subject == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "verified subject required"})
			return
		}
		c.Set(subjectKey, subject)
		c.Next()
	}
}

func Subject(c *gin.Context) string {
	if value, ok := c.Get(subjectKey); ok {
		if subject, ok := value.(string); ok {
			return subject
		}
	}
	return strings.TrimSpace(c.GetHeader("X-Axi-Subject"))
}
