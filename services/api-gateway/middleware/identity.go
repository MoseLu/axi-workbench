package middleware

import (
	"errors"
	"net/http"

	"github.com/epap/api-gateway/identity"
	"github.com/gin-gonic/gin"
)

const PrincipalContextKey = "axi.principal"

func RequireIdentity(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, sessionID, err := service.RestoreSession(c.Request.Context(), c.Request)
		if err == nil {
			service.SetCookie(c.Writer, sessionID)
			c.Set(PrincipalContextKey, principal)
			c.Next()
			return
		}
		if errors.Is(err, identity.ErrSessionStoreUnavailable) {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
			return
		}
		if !errors.Is(err, identity.ErrUnauthorized) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Axi OIDC session or bearer token required"})
			return
		}

		// Only an absent or invalid browser cookie may fall back to the existing
		// bearer-token and development-header authentication paths. A store
		// failure above is deliberately terminal so those paths cannot bypass a
		// broken durable-session chain.
		principal, err = service.Authenticate(c.Request.Context(), c.Request)
		if err != nil {
			if errors.Is(err, identity.ErrSessionStoreUnavailable) {
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
				return
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Axi OIDC session or bearer token required"})
			return
		}
		c.Set(PrincipalContextKey, principal)
		c.Next()
	}
}

func PrincipalFromContext(c *gin.Context) (identity.Principal, bool) {
	principal, ok := c.Get(PrincipalContextKey)
	if !ok {
		return identity.Principal{}, false
	}
	value, ok := principal.(identity.Principal)
	return value, ok && value.Subject != ""
}
