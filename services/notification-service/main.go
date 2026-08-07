package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"notification-service/config"
	"notification-service/handlers"
	"notification-service/middleware"
	"notification-service/services"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid notification service configuration: %v", err)
	}

	notificationService := services.NewNotificationService()
	notificationHandler := handlers.NewNotificationHandler(notificationService)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "notification-service"})
	})

	api := r.Group("/api/v1/notifications")
	api.Use(middleware.RequireGatewayIdentity(cfg))
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

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	log.Printf("Starting notification service on port %s", port)

	select {
	case serverErr := <-serverErrors:
		if serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			log.Printf("Notification service stopped unexpectedly: %v", serverErr)
		}
	case <-shutdownSignal.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			log.Printf("Failed to gracefully shut down notification service: %v", err)
			_ = server.Close()
		}
		if serverErr := <-serverErrors; serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			log.Printf("Notification service stopped with an error: %v", serverErr)
		}
	}
}
