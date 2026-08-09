package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/epap/api-gateway/config"
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
	router := setupRouter(cfg, proxyHandler, identityService, limiter, logger)
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
			logger.Error().Err(serverErr).Msg("API Gateway stopped with an error")
		}
	}
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
	identityService *identity.Service,
	limiter ratelimit.Limiter,
	logger zerolog.Logger,
) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.TraceContext())
	router.Use(observability.Gin("axi-api-gateway"))
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(cfg.CORS.AllowedOrigins, cfg.CORS.AllowedMethods, cfg.CORS.AllowedHeaders))
	router.Use(middleware.RateLimit(limiter))
	router.Use(middleware.Audit(logger))

	router.GET("/health", handlers.HealthCheck())
	router.GET("/ready", func(c *gin.Context) {
		if err := errors.Join(identityService.Ready(c.Request.Context()), limiter.Ping(c.Request.Context())); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "gateway dependencies are unavailable"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	v1 := router.Group("/api/v1")
	auth := v1.Group("/auth")
	auth.GET("/oidc/start", handlers.OIDCStart(identityService))
	auth.GET("/oidc/callback", handlers.OIDCCallback(identityService))
	auth.GET("/session", handlers.Session(identityService))
	auth.POST("/logout", handlers.Logout(identityService))
	auth.POST("/qr/transactions", proxyHandler.ProxyToIdentity())
	auth.GET("/qr/transactions/:id", proxyHandler.ProxyToIdentity())
	auth.POST("/qr/transactions/:id/resume", proxyHandler.ProxyToIdentity())
	auth.POST("/email-verifications", proxyHandler.ProxyToIdentity())
	auth.POST("/email-verifications/confirm", proxyHandler.ProxyToIdentity())
	// ZITADEL custom-login completes a QR transaction through the public
	// gateway. The adapter still checks its webhook secret; this path preserves
	// the sole-Ingress and ClusterIP-only identity-adapter topology.
	v1.POST("/internal/zitadel/qr/transactions/:id/complete", proxyHandler.ProxyToIdentity())
	// Platform Core is the only caller of this route. The gateway fans the
	// durable event out to notification and workflow consumers using their
	// dedicated internal credentials.
	v1.POST("/internal/events", middleware.RequireInternalToken(cfg.Services.PlatformOutboxToken), proxyHandler.ProxyToEventConsumers())

	mobileControl := handlers.NewMobileControlProxy(cfg.Services.ControlPlaneURL, cfg.Services.ControlPlaneInternalToken)
	protected := v1.Group("")
	protected.Use(middleware.RequireIdentity(identityService))
	protected.POST("/auth/qr/transactions/:id/approve", proxyHandler.ProxyToIdentity())
	protected.GET("/auth/eps/links/:provider", proxyHandler.ProxyToIdentity())
	protected.PUT("/auth/eps/links/:provider", proxyHandler.ProxyToIdentity())
	protected.GET("/handoffs/:id", mobileControl.ProxyWebHandoff())
	protected.POST("/handoffs/:id", mobileControl.ProxyWebHandoff())

	// Device-paired Mobile traffic carries a short-lived Control Plane bearer,
	// rather than a browser OIDC credential.  It remains behind this Gateway;
	// the downstream verifies the device token after this proxy strips spoofed
	// internal headers and attaches the Gateway credential.
	v1.Any("/mobile/*path", mobileControl.Proxy())

	// Platform Core routes are tenant-aware. The tenant ID comes from the path;
	// Platform Core also checks membership and RLS, so a forged client header
	// cannot turn another tenant into an authorized context.
	protected.GET("/tenants", proxyHandler.ProxyToPlatform())
	protected.POST("/tenants", proxyHandler.ProxyToPlatform())
	protected.GET("/tenants/:tenantID/members", proxyHandler.ProxyToPlatform())
	protected.PUT("/tenants/:tenantID/members/:memberSubject", proxyHandler.ProxyToPlatform())
	protected.GET("/me/preferences", proxyHandler.ProxyToPlatform())
	protected.PATCH("/me/preferences", proxyHandler.ProxyToPlatform())
	protected.GET("/tenants/:tenantID/dictionaries/:key", proxyHandler.ProxyToPlatform())
	protected.PUT("/tenants/:tenantID/dictionaries/:key", proxyHandler.ProxyToPlatform())
	protected.GET("/tenants/:tenantID/projects", proxyHandler.ProxyToPlatform())
	protected.POST("/tenants/:tenantID/projects", proxyHandler.ProxyToPlatform())
	protected.GET("/tenants/:tenantID/tasks", proxyHandler.ProxyToPlatform())
	protected.POST("/tenants/:tenantID/tasks", proxyHandler.ProxyToPlatform())

	// Existing core-service is compatibility-read-only only. It remains an
	// internal migration source and is not deployed by the production chart.
	if cfg.Services.LegacyCoreServiceURL != "" {
		legacyRead := func(next gin.HandlerFunc) gin.HandlerFunc {
			return func(c *gin.Context) {
				c.Header("Deprecation", "true")
				c.Header("Link", "</api/v1/tenants/{tenantID}/projects>; rel=successor-version")
				next(c)
			}
		}
		protected.GET("/projects", legacyRead(proxyHandler.ProxyToLegacyCore()))
		protected.GET("/projects/:id", legacyRead(proxyHandler.ProxyToLegacyCore()))
		protected.GET("/tasks", legacyRead(proxyHandler.ProxyToLegacyCore()))
		protected.GET("/tasks/:id", legacyRead(proxyHandler.ProxyToLegacyCore()))
	}

	protected.GET("/users/me", handlers.Session(identityService))
	protected.GET("/files/*path", proxyHandler.ProxyToFile())
	protected.POST("/files/*path", proxyHandler.ProxyToFile())
	protected.DELETE("/files/*path", proxyHandler.ProxyToFile())
	protected.GET("/workflows", proxyHandler.ProxyToWorkflow())
	protected.POST("/workflows", proxyHandler.ProxyToWorkflow())
	protected.GET("/workflows/:id", proxyHandler.ProxyToWorkflow())
	protected.PATCH("/workflows/:id", proxyHandler.ProxyToWorkflow())
	protected.PUT("/workflows/:id", proxyHandler.ProxyToWorkflow())
	protected.DELETE("/workflows/:id", proxyHandler.ProxyToWorkflow())
	protected.POST("/workflows/:id/execute", proxyHandler.ProxyToWorkflow())
	protected.GET("/notifications", proxyHandler.ProxyToNotification())
	protected.POST("/notifications", proxyHandler.ProxyToNotification())
	protected.PUT("/notifications/read-all", proxyHandler.ProxyToNotification())
	protected.PUT("/notifications/:id/read", proxyHandler.ProxyToNotification())
	protected.GET("/notifications/nav-badges", proxyHandler.ProxyToNotification())
	router.NoRoute(handlers.NotFoundHandler())
	return router
}
