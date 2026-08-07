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
	cfg := config.Load()

	notificationService := services.NewNotificationService()
	notificationHandler := handlers.NewNotificationHandler(notificationService)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "notification-service"})
	})

	api := r.Group("/api/v1/notifications")
	{
		api.POST("", notificationHandler.CreateNotification)
		api.GET("", notificationHandler.ListNotifications)
		// Static path before /:id
		api.GET("/nav-badges", notificationHandler.GetNavBadges)
		api.PUT("/read-all", notificationHandler.MarkAllRead)
		api.PUT("/:id/read", notificationHandler.MarkRead)
	}

	port := cfg.Port
	if port == "" {
		port = "8084"
	}

	log.Printf("Starting notification service on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
		os.Exit(1)
	}
}
