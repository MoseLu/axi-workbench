package main

import (
	"os"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/handlers"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Setup logger
	logger := setupLogger(cfg.Log.Level)

	// Create proxy handler
	proxyHandler := handlers.NewProxyHandler(
		cfg.Services.AuthServiceURL,
		cfg.Services.CoreServiceURL,
		cfg.Services.FileServiceURL,
		cfg.Services.WorkflowURL,
		cfg.Services.NotificationURL,
	)

	// Setup router
	router := setupRouter(cfg, proxyHandler, logger)

	// Start server
	logger.Info().Str("port", cfg.Server.Port).Msg("starting API Gateway")
	if err := router.Run(":" + cfg.Server.Port); err != nil {
		logger.Error().Err(err).Msg("failed to start server")
		os.Exit(1)
	}
}

func setupLogger(level string) zerolog.Logger {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	lvl, err := zerolog.ParseLevel(level)
	if err != nil {
		lvl = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(lvl)
	return zerolog.New(os.Stdout).With().Timestamp().Logger()
}

func setupRouter(cfg *config.Config, proxyHandler *handlers.ProxyHandler, logger zerolog.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// Global middleware
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(
		cfg.CORS.AllowedOrigins,
		cfg.CORS.AllowedMethods,
		cfg.CORS.AllowedHeaders,
	))

	// Health check endpoints (no auth required)
	router.GET("/health", handlers.HealthCheck())
	router.GET("/ready", handlers.ReadyCheck())

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Auth routes (no auth required for login/register)
		auth := v1.Group("/auth")
		{
			auth.POST("/login", proxyHandler.ProxyToAuth())
			auth.POST("/register", proxyHandler.ProxyToAuth())
			auth.POST("/refresh", proxyHandler.ProxyToAuth())
			auth.POST("/logout", middleware.JWTAuth(cfg.JWT.Secret), proxyHandler.ProxyToAuth())
		}

		// Protected routes (auth required)
		protected := v1.Group("")
		protected.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			// Core service routes
			core := protected.Group("/projects")
			{
				core.GET("", proxyHandler.ProxyToCore())
				core.POST("", proxyHandler.ProxyToCore())
				core.GET("/:id", proxyHandler.ProxyToCore())
				core.PUT("/:id", proxyHandler.ProxyToCore())
				core.DELETE("/:id", proxyHandler.ProxyToCore())
			}

			// Tasks
			tasks := protected.Group("/tasks")
			{
				tasks.GET("", proxyHandler.ProxyToCore())
				tasks.POST("", proxyHandler.ProxyToCore())
				tasks.GET("/:id", proxyHandler.ProxyToCore())
				tasks.PUT("/:id", proxyHandler.ProxyToCore())
				tasks.DELETE("/:id", proxyHandler.ProxyToCore())
			}

			// File service routes
			files := protected.Group("/files")
			{
				files.GET("/*path", proxyHandler.ProxyToFile())
				files.POST("/*path", proxyHandler.ProxyToFile())
				files.DELETE("/*path", proxyHandler.ProxyToFile())
			}

			// Workflow routes
			workflows := protected.Group("/workflows")
			{
				workflows.GET("", proxyHandler.ProxyToWorkflow())
				workflows.POST("", proxyHandler.ProxyToWorkflow())
				workflows.GET("/:id", proxyHandler.ProxyToWorkflow())
				workflows.PUT("/:id", proxyHandler.ProxyToWorkflow())
				workflows.DELETE("/:id", proxyHandler.ProxyToWorkflow())
				workflows.POST("/:id/execute", proxyHandler.ProxyToWorkflow())
			}

			// Notification routes
			notifications := protected.Group("/notifications")
			{
				notifications.GET("", proxyHandler.ProxyToNotification())
				notifications.PUT("/:id/read", proxyHandler.ProxyToNotification())
				notifications.PUT("/read-all", proxyHandler.ProxyToNotification())
			}

			// User routes
			users := protected.Group("/users")
			{
				users.GET("/me", proxyHandler.ProxyToAuth())
				users.PUT("/me", proxyHandler.ProxyToAuth())
				users.PUT("/me/password", proxyHandler.ProxyToAuth())
			}
		}
	}

	// 404 handler
	router.NoRoute(handlers.NotFoundHandler())

	return router
}
