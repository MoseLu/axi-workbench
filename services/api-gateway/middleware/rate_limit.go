package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
)

// RateLimit applies a Redis-backed fixed window keyed by caller address. It is
// intentionally before auth so public OIDC and email endpoints are protected.
func RateLimit(limiter ratelimit.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		decision, err := limiter.Allow(c.Request.Context(), c.ClientIP())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "rate limit storage unavailable"})
			return
		}
		c.Header("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(decision.ResetAt.Unix(), 10))
		if !decision.Allowed {
			c.Header("Retry-After", strconv.Itoa(max(int(decision.ResetAt.Sub(time.Now()).Seconds()), 1)))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
