package middleware

import (
	"net/http"

	"github.com/epap/api-gateway/identity"
	"github.com/gin-gonic/gin"
)

const PrincipalContextKey = "axi.principal"

func RequireIdentity(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, err := service.Authenticate(c.Request.Context(), c.Request)
		if err != nil {
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
