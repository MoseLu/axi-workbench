package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/axiomaticworld/observability/go/axilog"
	"github.com/gin-gonic/gin"

	"notification-service/config"
	"notification-service/handlers"
	"notification-service/middleware"
	"notification-service/services"
)

// Adopt the workspace observability SDK (PRD-07 phase 2). All
// diagnostic chatter flows through the JSON handler with trace_id /
// request_id auto-injection; sensitive fields are redacted by default.
var logger = axilog.New(axilog.Options{
	Service: axilog.WithService("axi-notification-service"),
})

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		logger.Error("invalid notification service configuration", slog.Any("error", err))
		os.Exit(1)
	}

	notificationService, err := services.NewNotificationServiceWithContext(context.Background())
	if err != nil {
		logger.Error("initialize notification repository", slog.Any("error", err))
		os.Exit(1)
	}
	defer notificationService.Close()
	notificationHandler := handlers.NewNotificationHandler(notificationService)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "notification-service"})
	})
	r.GET("/ready", func(c *gin.Context) {
		if err := notificationService.Ping(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready", "service": "notification-service"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready", "service": "notification-service"})
	})

	api := r.Group("/api/v1/notifications")
	api.Use(middleware.RequireGatewayIdentity(cfg))
	{
		api.POST("", notificationHandler.CreateNotification)
		api.GET("", notificationHandler.ListNotifications)
		// Static path before /:id
		api.GET("/nav-badges", notificationHandler.GetNavBadges)
		api.PUT("/read-all", notificationHandler.MarkAllRead)
		api.POST("/read-receipts", notificationHandler.MarkAllRead)
		api.PUT("/:id/read", notificationHandler.MarkRead)
		api.PATCH("/:id", notificationHandler.MarkRead)
	}
	r.POST("/internal/events", middleware.RequireInternalEvent(cfg), notificationHandler.ConsumeEvent)

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
	kafkaConsumer, err := services.NewKafkaEventConsumer(cfg, notificationService)
	if err != nil {
		logger.Error("initialize Kafka event consumer", slog.Any("error", err))
		os.Exit(1)
	}
	consumerContext, cancelConsumer := context.WithCancel(shutdownSignal)
	defer cancelConsumer()
	if kafkaConsumer != nil {
		go func() {
			if err := kafkaConsumer.Run(consumerContext); err != nil && !errors.Is(err, context.Canceled) {
				logger.Error("Kafka event consumer stopped", slog.Any("error", err))
			}
		}()
		defer func() {
			if err := kafkaConsumer.Close(); err != nil {
				logger.Error("close Kafka event consumer", slog.Any("error", err))
			}
		}()
	}
	notificationService.StartDeliveryWorker(shutdownSignal)
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	logger.Info("Starting notification service", slog.String("port", port))

	select {
	case serverErr := <-serverErrors:
		if serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("Notification service stopped unexpectedly", slog.Any("error", serverErr))
		}
	case <-shutdownSignal.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			logger.Error("Failed to gracefully shut down notification service", slog.Any("error", err))
			_ = server.Close()
		}
		if serverErr := <-serverErrors; serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("Notification service stopped with an error", slog.Any("error", serverErr))
		}
	}
}
