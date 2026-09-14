package handlers

import (
	"net/http"
	"strings"

	"github.com/epap/api-gateway/gateway"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// DynamicRouteHandler handles dynamic route matching at runtime.
type DynamicRouteHandler struct {
	dynamicRouter   *gateway.DynamicRouter
	proxyHandler    *ProxyHandler
	identityService *identity.Service
	limiter         ratelimit.Limiter
	mobileControl   *MobileControlProxy
	internalToken   string
	logger          zerolog.Logger
}

// NewDynamicRouteHandler creates a new dynamic route handler.
func NewDynamicRouteHandler(
	dynamicRouter *gateway.DynamicRouter,
	proxyHandler *ProxyHandler,
	identityService *identity.Service,
	limiter ratelimit.Limiter,
	mobileControl *MobileControlProxy,
	internalToken string,
	logger zerolog.Logger,
) *DynamicRouteHandler {
	return &DynamicRouteHandler{
		dynamicRouter:   dynamicRouter,
		proxyHandler:    proxyHandler,
		identityService: identityService,
		limiter:         limiter,
		mobileControl:   mobileControl,
		internalToken:   internalToken,
		logger:          logger,
	}
}

// NoRoute returns a Gin handler that matches dynamic routes.
// This handler is used as a fallback when no static route matches.
func (drh *DynamicRouteHandler) NoRoute() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Gin defaults some methods to 200, which bypasses our allowlist.
		// Explicitly reject these methods before route matching.
		method := c.Request.Method
		if method == http.MethodConnect || method == http.MethodTrace {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
				"error": "Method Not Allowed",
			})
			return
		}

		route := drh.dynamicRouter.Match(c.Request.URL.Path, c.Request.Method)
		if route == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Dynamic Route Not Found",
				"message": "No dynamic route matches the requested path",
			})
			return
		}

		// Check internal route access
		if route.Internal {
			supplied := c.GetHeader("X-Axi-Internal-Token")
			if supplied != drh.internalToken {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				return
			}
		}

		// Build middleware chain for the route
		chain := drh.buildMiddlewareChain(route)

		// Get the handler function
		handler := drh.resolveHandler(route)

		// Execute middleware chain
		for _, mw := range chain {
			mw(c)
			if c.IsAborted() {
				return
			}
		}

		// Execute the main handler
		handler(c)
	}
}

// buildMiddlewareChain builds the middleware chain for a dynamic route.
func (drh *DynamicRouteHandler) buildMiddlewareChain(route *gateway.Route) []gin.HandlerFunc {
	var chain []gin.HandlerFunc

	for _, filter := range route.Filters {
		mw := drh.resolveFilter(filter)
		if mw != nil {
			chain = append(chain, mw)
		}
	}

	// Internal routes require internal token middleware
	if route.Internal {
		chain = append(chain, middleware.RequireInternalToken(drh.internalToken))
	}

	return chain
}

// resolveHandler resolves the handler function for a dynamic route.
func (drh *DynamicRouteHandler) resolveHandler(route *gateway.Route) gin.HandlerFunc {
	// If we have an upstream URL, use proxy handler
	if route.Upstream != "" {
		return drh.proxyHandler.GenericProxy(route.Upstream, drh.internalToken)
	}

	// Resolve by handler name
	switch route.Handler {
	case "HealthCheck":
		return HealthCheck()
	case "Ready":
		return ReadyCheck()
	case "Session":
		return Session(drh.identityService)
	case "Logout":
		return Logout(drh.identityService)
	case "OIDCStart":
		return OIDCStart(drh.identityService)
	case "OIDCCallback":
		return OIDCCallback(drh.identityService)
	case "AuthMethods":
		return AuthMethods(drh.identityService)
	case "PasswordLogin":
		return PasswordLogin(drh.identityService)
	case "RedeemResume":
		return RedeemResume(drh.identityService)
	case "GetProfile":
		return GetProfile(drh.identityService)
	case "UpdateProfile":
		return UpdateProfile(drh.identityService)
	case "MobileControlProxy":
		return drh.mobileControl.Proxy()
	case "ProxyWebControl":
		return drh.mobileControl.ProxyWebControl()
	case "ConsumeWebLogin":
		return drh.mobileControl.ConsumeWebLogin(drh.identityService)
	case "ProxyToIdentity":
		return drh.proxyHandler.ProxyToIdentity()
	case "ProxyToPlatform":
		return drh.proxyHandler.ProxyToPlatform()
	case "ProxyToFile":
		return drh.proxyHandler.ProxyToFile()
	case "ProxyToWorkflow":
		return drh.proxyHandler.ProxyToWorkflow()
	case "ProxyToNotification":
		return drh.proxyHandler.ProxyToNotification()
	case "ProxyToEventConsumers":
		return drh.proxyHandler.ProxyToEventConsumers()
	default:
		drh.logger.Warn().Str("handler", route.Handler).Msg("unknown dynamic handler, using not found")
		return NotFoundHandler()
	}
}

// resolveFilter resolves a filter name to a middleware function.
func (drh *DynamicRouteHandler) resolveFilter(filter string) gin.HandlerFunc {
	filterName, _ := parseFilterName(filter)

	switch filterName {
	case "RequireIdentity":
		return middleware.RequireIdentity(drh.identityService)
	case "RequireInternalToken":
		return middleware.RequireInternalToken(drh.internalToken)
	case "Audit":
		return middleware.Audit(drh.logger)
	case "RateLimit":
		// RateLimit filter is handled globally
		return func(c *gin.Context) { c.Next() }
	case "StripPrefix":
		// Path stripping is handled by the proxy handler configuration
		return func(c *gin.Context) { c.Next() }
	default:
		drh.logger.Warn().Str("filter", filterName).Msg("unknown dynamic filter, skipping")
		return nil
	}
}

// parseFilterName extracts the filter name from a filter string.
func parseFilterName(filter string) (string, []string) {
	parts := strings.SplitN(filter, "=", 2)
	name := strings.TrimSpace(parts[0])
	var args []string
	if len(parts) == 2 {
		for _, arg := range strings.Split(parts[1], ",") {
			arg = strings.TrimSpace(arg)
			if arg != "" {
				args = append(args, arg)
			}
		}
	}
	return name, args
}
