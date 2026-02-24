package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"notification-service/config"
	"notification-service/handlers"
	"notification-service/services"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize services
	notificationService := services.NewNotificationService()
	notificationHandler := handlers.NewNotificationHandler(notificationService)

	// Setup Gin router
	r := gin.Default()

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "notification-service"})
	})

	// API routes
	api := r.Group("/api/v1/notifications")
	{
		api.POST("", notificationHandler.CreateNotification)
		api.GET("", notificationHandler.ListNotifications)
	}

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting notification service on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
		os.Exit(1)
	}
}
