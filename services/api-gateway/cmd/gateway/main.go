package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/discovery"
	"github.com/epap/api-gateway/gateway"
	"github.com/epap/api-gateway/handlers"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/epap/api-gateway/observability"
	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("gateway configuration: " + err.Error())
	}
	logger := setupLogger(cfg.Log.Level)
	shutdownTelemetry, err := observability.Setup(context.Background(), "axi-api-gateway", cfg.Observability.OTLPTracesEndpoint)
	if err != nil {
		logger.Fatal().Err(err).Msg("initialize OpenTelemetry trace exporter")
	}
	defer func() {
		shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownTelemetry(shutdownContext); err != nil {
			logger.Error().Err(err).Msg("flush OpenTelemetry trace exporter")
		}
	}()

	identityService, err := identity.New(context.Background(), cfg.Identity)
	if err != nil {
		logger.Fatal().Err(err).Msg("initialize OIDC/JWKS verifier")
	}
	defer identityService.Close()

	limiter, err := newLimiter(cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("initialize gateway rate limiter")
	}
	defer limiter.Close()

	proxyHandler := handlers.NewProxyHandler(
		cfg.Services.IdentityAdapterURL,
		cfg.Services.PlatformCoreURL,
		cfg.Services.LegacyCoreServiceURL,
		cfg.Services.FileServiceURL,
		cfg.Services.WorkflowURL,
		cfg.Services.NotificationURL,
		cfg.Services.IdentityInternalToken,
		cfg.Services.PlatformInternalToken,
		cfg.Services.FileInternalToken,
		cfg.Services.WorkflowInternalToken,
		cfg.Services.NotificationInternalToken,
	)

	mobileControl := handlers.NewMobileControlProxy(cfg.Services.ControlPlaneURL, cfg.Services.ControlPlaneInternalToken)

	// Initialize service discovery manager (optional, falls back to static URLs)
	var discoveryManager *discovery.Manager
	if len(cfg.Services.Upstreams) > 0 {
		discoveryManager = discovery.NewManager(logger)
		for _, upstream := range cfg.Services.Upstreams {
			discoveryManager.RegisterUpstream(upstream)
		}
		logger.Info().Int("count", len(cfg.Services.Upstreams)).Msg("service discovery initialized")
	}

	// Load route configuration
	routeMatcher, err := loadRouteConfig()
	if err != nil {
		logger.Fatal().Err(err).Msg("load route configuration")
	}

	// Initialize dynamic router for hot-reload support
	dynamicRouter := gateway.NewDynamicRouter(routeMatcher, getRoutesConfigPath(), logger)

	// Initialize dynamic route handler for runtime route matching
	dynamicRouteHandler := handlers.NewDynamicRouteHandler(
		dynamicRouter,
		proxyHandler,
		identityService,
		limiter,
		mobileControl,
		cfg.Services.ControlPlaneInternalToken,
		logger,
	)

	// Start configuration file watcher
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := dynamicRouter.StartWatcher(ctx); err != nil {
		logger.Warn().Err(err).Msg("failed to start config watcher, using polling fallback")
	}

	router := setupRouter(cfg, proxyHandler, mobileControl, identityService, limiter, routeMatcher, dynamicRouter, dynamicRouteHandler, logger)

	server := &http.Server{
		Addr:              ":" + cfg.Server.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       cfg.Server.ReadTimeout,
		WriteTimeout:      cfg.Server.WriteTimeout,
		IdleTimeout:       60 * time.Second,
	}
	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()

	logger.Info().Str("port", cfg.Server.Port).Msg("starting Axi API Gateway")
	select {
	case serverErr := <-serverErrors:
		if serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error().Err(serverErr).Msg("API Gateway stopped unexpectedly")
		}
	case <-shutdownSignal.Done():
		logger.Info().Msg("shutting down Axi API Gateway")
		shutdownContext, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			logger.Error().Err(err).Msg("gracefully shut down API Gateway")
			_ = server.Close()
		}
		if serverErr := <-serverErrors; serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error().Err(err).Msg("API Gateway stopped with an error")
		}
	}
}

// loadRouteConfig loads route configuration from YAML file with fallback
func loadRouteConfig() (*config.RouteMatcher, error) {
	routesPath := getRoutesConfigPath()

	matcher, err := config.LoadRoutes(routesPath)
	if err != nil {
		// If file not found, try relative path (useful for development)
		matcher, err = config.LoadRoutes("config/routes.yaml")
		if err != nil {
			return nil, err
		}
	}

	return matcher, nil
}

func setupLogger(level string) zerolog.Logger {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	parsed, err := zerolog.ParseLevel(level)
	if err != nil {
		parsed = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(parsed)
	return zerolog.New(os.Stdout).With().Timestamp().Logger()
}

func newLimiter(cfg *config.Config) (ratelimit.Limiter, error) {
	if cfg.RateLimit.RedisURL == "" {
		return ratelimit.NewMemory(cfg.RateLimit.RequestsPerMinute, nil), nil
	}
	return ratelimit.NewRedis(cfg.RateLimit.RedisURL, cfg.RateLimit.RequestsPerMinute)
}

func setupRouter(
	cfg *config.Config,
	proxyHandler *handlers.ProxyHandler,
	mobileControl *handlers.MobileControlProxy,
	identityService *identity.Service,
	limiter ratelimit.Limiter,
	routeMatcher *config.RouteMatcher,
	dynamicRouter *gateway.DynamicRouter,
	dynamicRouteHandler *handlers.DynamicRouteHandler,
	logger zerolog.Logger,
) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	// Gin otherwise trusts arbitrary X-Forwarded-For values. Keep the default
	// fail-closed for a private deployment; only explicitly configured ingress
	// networks may influence ClientIP-based rate limiting.
	if err := router.SetTrustedProxies(cfg.Server.TrustedProxies); err != nil {
		panic("gateway trusted proxies: " + err.Error())
	}
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.TraceContext())
	router.Use(observability.Gin("axi-api-gateway"))
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(cfg.CORS.AllowedOrigins, cfg.CORS.AllowedMethods, cfg.CORS.AllowedHeaders))
	router.Use(middleware.RateLimit(limiter))
	router.Use(middleware.Audit(logger))

	// Register routes from configuration
	registry := handlers.NewRouteRegistry(handlers.RouteRegistryConfig{
		RouteMatcher:               routeMatcher,
		ProxyHandler:              proxyHandler,
		IdentityService:           identityService,
		Limiter:                  limiter,
		MobileControl:            mobileControl,
		InternalToken:            cfg.Services.ControlPlaneInternalToken,
		IdentityAdapterURL:       cfg.Services.IdentityAdapterURL,
		Logger:                   logger,
		PlatformInternalToken:     cfg.Services.PlatformInternalToken,
		IdentityInternalToken:     cfg.Services.IdentityInternalToken,
		FileInternalToken:        cfg.Services.FileInternalToken,
		WorkflowInternalToken:    cfg.Services.WorkflowInternalToken,
		NotificationInternalToken: cfg.Services.NotificationInternalToken,
	})

	if err := registry.RegisterRoutes(router); err != nil {
		logger.Fatal().Err(err).Msg("register configured routes")
	}

	// Also register routes that are not easily configurable
	registerAdditionalRoutes(router, identityService, mobileControl)

	// Register admin routes for dynamic route management
	registerAdminRoutes(router, dynamicRouter, cfg.Services.ControlPlaneInternalToken, logger)

	// NoRoute handler for dynamic routes (registered routes take precedence)
	router.NoRoute(dynamicRouteHandler.NoRoute())
	return router
}

// registerAdditionalRoutes registers routes that have complex logic not suitable for YAML config
func registerAdditionalRoutes(router *gin.Engine, identityService *identity.Service, mobileControl *handlers.MobileControlProxy) {
	// Health check
	router.GET("/health", handlers.HealthCheck())

	// Ready check (depends on identity service)
	router.GET("/ready", func(c *gin.Context) {
		if err := errors.Join(identityService.Ready(c.Request.Context())); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "gateway dependencies are unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
}

// registerAdminRoutes registers the admin routes for dynamic route management
func registerAdminRoutes(router *gin.Engine, dynamicRouter *gateway.DynamicRouter, internalToken string, logger zerolog.Logger) {
	adminHandler := gateway.NewAdminHandler(dynamicRouter, internalToken, logger)
	adminHandler.RegisterRoutes(router.Group("/api/v1"))
}

// getRoutesConfigPath returns the path to the routes configuration file
func getRoutesConfigPath() string {
	routesPath := os.Getenv("ROUTES_CONFIG_PATH")
	if routesPath == "" {
		// Default to config/routes.yaml in the same directory as the binary
		execPath, err := os.Executable()
		if err != nil {
			// Fallback to relative path
			routesPath = "config/routes.yaml"
		} else {
			routesPath = filepath.Join(filepath.Dir(execPath), "config", "routes.yaml")
		}
	}
	return routesPath
}
