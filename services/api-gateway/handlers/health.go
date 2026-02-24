package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthCheck returns the health status of the API Gateway
func HealthCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-gateway",
			"version": "1.0.0",
		})
	}
}

// ReadyCheck returns the readiness status (can check backend services)
func ReadyCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		// In production, you would check connectivity to backend services here
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
		})
	}
}
