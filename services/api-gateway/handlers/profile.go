package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

func GetProfile(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, ok := middleware.PrincipalFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verified identity required"})
			return
		}
		principal, err := service.ResolvePrincipalProfile(c.Request.Context(), principal)
		if err != nil {
			writeProfileError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": principal})
	}
}

func UpdateProfile(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		principal, ok := middleware.PrincipalFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verified identity required"})
			return
		}
		var request struct {
			Username string `json:"username" binding:"required"`
		}
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username is required"})
			return
		}
		updated, err := service.UpdatePrincipalUsername(c.Request.Context(), principal, strings.TrimSpace(request.Username))
		if err != nil {
			writeProfileError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": updated})
	}
}

func writeProfileError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, identity.ErrInvalidUsername):
		c.JSON(http.StatusBadRequest, gin.H{"error": "username must be 3-16 characters using letters, numbers, CJK characters, underscore, hyphen, or dot"})
	case errors.Is(err, identity.ErrSessionStoreUnavailable):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "profile store unavailable"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load profile"})
	}
}
