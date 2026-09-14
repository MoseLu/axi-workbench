package handlers

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// RouteRegistry manages route registration from configuration
type RouteRegistry struct {
	matcher           *config.RouteMatcher
	proxyHandler      *ProxyHandler
	identityService   *identity.Service
	limiter           ratelimit.Limiter
	mobileControl     *MobileControlProxy
	internalToken     string
	identityAdapterURL string
	logger            zerolog.Logger
	registeredRoutes  map[string]bool
	mu                sync.RWMutex
	// Per-upstream internal tokens for GenericProxy
	platformInternalToken      string
	identityInternalToken      string
	fileInternalToken         string
	workflowInternalToken     string
	notificationInternalToken string
}

// RouteRegistryConfig holds dependencies for the route registry
type RouteRegistryConfig struct {
	RouteMatcher                *config.RouteMatcher
	ProxyHandler               *ProxyHandler
	IdentityService             *identity.Service
	Limiter                    ratelimit.Limiter
	MobileControl               *MobileControlProxy
	InternalToken              string
	IdentityAdapterURL         string
	Logger                     zerolog.Logger
	PlatformInternalToken      string
	IdentityInternalToken      string
	FileInternalToken          string
	WorkflowInternalToken      string
	NotificationInternalToken string
}

// NewRouteRegistry creates a new route registry
func NewRouteRegistry(cfg RouteRegistryConfig) *RouteRegistry {
	return &RouteRegistry{
		matcher:          cfg.RouteMatcher,
		proxyHandler:     cfg.ProxyHandler,
		identityService:  cfg.IdentityService,
		limiter:         cfg.Limiter,
		mobileControl:   cfg.MobileControl,
		internalToken:   cfg.InternalToken,
		identityAdapterURL: cfg.IdentityAdapterURL,
		logger:          cfg.Logger,
		registeredRoutes: make(map[string]bool),
		// Per-upstream internal tokens for GenericProxy
		platformInternalToken:      cfg.PlatformInternalToken,
		identityInternalToken:      cfg.IdentityInternalToken,
		fileInternalToken:         cfg.FileInternalToken,
		workflowInternalToken:     cfg.WorkflowInternalToken,
		notificationInternalToken: cfg.NotificationInternalToken,
	}
}

// RegisterRoutes registers all routes from configuration to the gin router
func (rr *RouteRegistry) RegisterRoutes(router *gin.Engine) error {
	routes := rr.matcher.GetRoutes()

	for _, route := range routes {
		if err := rr.registerRoute(router, &route); err != nil {
			return fmt.Errorf("failed to register route %q: %w", route.ID, err)
		}
		rr.mu.Lock()
		rr.registeredRoutes[route.ID] = true
		rr.mu.Unlock()
	}

	rr.logger.Info().Int("count", len(routes)).Msg("routes registered from configuration")
	return nil
}

// registerRoute registers a single route
func (rr *RouteRegistry) registerRoute(router *gin.Engine, route *config.Route) error {
	methods := config.ParseMethodPredicate(route.Predicates)
	if len(methods) == 0 {
		methods = []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"}
	}

	// Build middleware chain
	middlewareChain, err := rr.buildMiddlewareChain(route)
	if err != nil {
		return err
	}

	// Get the handler function
	handler := rr.resolveHandler(route)

	// Register the route
	for _, method := range methods {
		router.Handle(method, route.Path, append(middlewareChain, handler)...)
	}

	return nil
}

// buildMiddlewareChain builds the middleware chain for a route
func (rr *RouteRegistry) buildMiddlewareChain(route *config.Route) ([]gin.HandlerFunc, error) {
	var chain []gin.HandlerFunc

	for _, filter := range route.Filters {
		mw, err := rr.resolveFilter(filter)
		if err != nil {
			return nil, err
		}
		chain = append(chain, mw)
	}

	// Add internal token middleware for internal routes
	if route.Internal {
		chain = append(chain, middleware.RequireInternalToken(rr.internalToken))
	}

	return chain, nil
}

// resolveHandler resolves the handler function for a route
func (rr *RouteRegistry) resolveHandler(route *config.Route) gin.HandlerFunc {
	// If we have an upstream URL, use proxy handler with the correct internal token
	if route.Upstream != "" {
		internalToken := rr.getInternalTokenForUpstream(route.UpstreamType)
		return rr.proxyHandler.GenericProxy(route.Upstream, internalToken)
	}

	// Resolve by handler name
	switch route.Handler {
	case "HealthCheck":
		return HealthCheck()
	case "Ready":
		return ReadyCheck()
	case "Session":
		return Session(rr.identityService)
	case "Logout":
		return Logout(rr.identityService)
	case "OIDCStart":
		return OIDCStart(rr.identityService)
	case "OIDCCallback":
		return OIDCCallback(rr.identityService)
	case "AuthMethods":
		return AuthMethods(rr.identityService)
	case "PasswordLogin":
		return PasswordLogin(rr.identityService)
	case "RedeemResume":
		return RedeemResume(rr.identityService)
	case "GetProfile":
		return GetProfile(rr.identityService)
	case "UpdateProfile":
		return UpdateProfile(rr.identityService)
	case "MobileControlProxy":
		return rr.mobileControl.Proxy()
	case "ProxyWebControl":
		return rr.mobileControl.ProxyWebControl()
	case "ConsumeWebLogin":
		return rr.mobileControl.ConsumeWebLogin(rr.identityService)
	case "ProxyToIdentity":
		return rr.proxyHandler.ProxyToIdentity()
	case "ProxyToPlatform":
		return rr.proxyHandler.ProxyToPlatform()
	case "ProxyToFile":
		return rr.proxyHandler.ProxyToFile()
	case "ProxyToWorkflow":
		return rr.proxyHandler.ProxyToWorkflow()
	case "ProxyToNotification":
		return rr.proxyHandler.ProxyToNotification()
	case "ProxyToEventConsumers":
		return rr.proxyHandler.ProxyToEventConsumers()
	case "EmailLoginConfirm":
		return EmailLoginConfirm(rr.identityService, rr.identityAdapterURL)
	default:
		rr.logger.Warn().Str("handler", route.Handler).Msg("unknown handler, using not found")
		return NotFoundHandler()
	}
}

// resolveFilter resolves a filter name to a middleware function
func (rr *RouteRegistry) resolveFilter(filter string) (gin.HandlerFunc, error) {
	filterName, _ := config.ParseFilter(filter)

	switch filterName {
	case "RequireIdentity":
		return middleware.RequireIdentity(rr.identityService), nil
	case "RequireInternalToken":
		return middleware.RequireInternalToken(rr.internalToken), nil
	case "Audit":
		return middleware.Audit(rr.logger), nil
	case "RateLimit":
		// RateLimit filter is handled globally in setupRouter
		return func(c *gin.Context) { c.Next() }, nil
	case "StripPrefix":
		// Parse the numeric argument for stripping path segments
		_, args := config.ParseFilter(filter)
		if len(args) > 0 {
			if n, err := strconv.Atoi(args[0]); err == nil && n > 0 {
				return middleware.StripPathSegments(n), nil
			}
		}
		// Fallback: no-op if no valid numeric argument
		return func(c *gin.Context) { c.Next() }, nil
	default:
		return nil, fmt.Errorf("unknown filter: %q", filterName)
	}
}

// GetRegisteredRoutes returns the list of registered route IDs
func (rr *RouteRegistry) GetRegisteredRoutes() []string {
	rr.mu.RLock()
	defer rr.mu.RUnlock()

	routes := make([]string, 0, len(rr.registeredRoutes))
	for id := range rr.registeredRoutes {
		routes = append(routes, id)
	}
	return routes
}

// RouteStats provides statistics about registered routes
type RouteStats struct {
	TotalRoutes    int
	HandlerRoutes  int
	UpstreamRoutes int
	InternalRoutes int
}

// GetStats returns statistics about registered routes
func (rr *RouteRegistry) GetStats() RouteStats {
	routes := rr.matcher.GetRoutes()
	stats := RouteStats{TotalRoutes: len(routes)}

	for _, r := range routes {
		if r.Internal {
			stats.InternalRoutes++
		}
		if r.Upstream != "" {
			stats.UpstreamRoutes++
		} else {
			stats.HandlerRoutes++
		}
	}

	return stats
}

// parseInt is a helper to parse integers from strings
func parseInt(s string) int {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n
}

// getInternalTokenForUpstream returns the appropriate internal token based on upstream type
func (rr *RouteRegistry) getInternalTokenForUpstream(upstreamType string) string {
	switch upstreamType {
	case "platform", "control-plane":
		return rr.platformInternalToken
	case "identity":
		return rr.identityInternalToken
	case "file":
		return rr.fileInternalToken
	case "workflow":
		return rr.workflowInternalToken
	case "notification":
		return rr.notificationInternalToken
	default:
		// Fallback to the default internal token for backward compatibility
		return rr.internalToken
	}
}
