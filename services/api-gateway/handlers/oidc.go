package handlers

import (
	"errors"
	"net/http"

	"github.com/epap/api-gateway/identity"
	"github.com/gin-gonic/gin"
)

func OIDCStart(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		returnTo := c.Query("return_to")
		if returnTo == "" {
			returnTo = "/"
		}
		location, err := service.Begin(c.Request.Context(), returnTo)
		if err != nil {
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Axi OIDC issuer is not configured"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid OIDC login request"})
			return
		}
		http.Redirect(c.Writer, c.Request, location, http.StatusFound)
	}
}

func OIDCCallback(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		state := c.Query("state")
		code := c.Query("code")
		if state == "" || code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "OIDC callback requires state and code"})
			return
		}
		sessionID, _, returnTo, err := service.Complete(c.Request.Context(), state, code)
		if err != nil {
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Axi OIDC issuer is not configured"})
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "OIDC authorization could not be completed"})
			return
		}
		service.SetCookie(c.Writer, sessionID)
		http.Redirect(c.Writer, c.Request, returnTo, http.StatusFound)
	}
}

func Session(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, err := service.Authenticate(c.Request.Context(), c.Request)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": principal})
	}
}

func Logout(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := service.Logout(c.Request.Context(), c.Request); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
			return
		}
		service.ClearCookie(c.Writer)
		c.Status(http.StatusNoContent)
	}
}
