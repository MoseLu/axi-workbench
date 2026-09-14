package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// Filter is the processing interface for request/response handling.
// Inspired by Spring Cloud Gateway's GatewayFilter pattern.
// Filters are executed in order, and can short-circuit by not calling Next().
type Filter interface {
	Name() string
	Filter(c *gin.Context, chain FilterChain)
}

// FilterChain represents a sequence of filters to be executed.
// It is similar to javax.servlet.FilterChain in Java or koa-compose in Node.js.
type FilterChain []Filter

// Next executes the next filter in the chain.
// If there are no more filters, it calls the terminal handler.
func (fc FilterChain) Next(c *gin.Context) {
	if len(fc) == 0 {
		c.Next()
		return
	}
	fc[0].Filter(c, fc[1:])
}

// RouteFilter applies a predicate-based filter chain to gin routes.
// It provides Spring Cloud Gateway-style route configuration.
type RouteFilter struct {
	Predicate Predicate
	Filters   FilterChain
}

func (rf RouteFilter) Match(c *gin.Context) bool {
	return rf.Predicate.Match(c)
}

func (rf RouteFilter) Apply(c *gin.Context) {
	if rf.Predicate.Match(c) {
		rf.Filters.Next(c)
	} else {
		c.Next()
	}
}

// FilterAdapter wraps a gin.HandlerFunc as a Filter for use in FilterChain.
type FilterAdapter struct {
	NameVal string
	Handler gin.HandlerFunc
}

func (fa FilterAdapter) Name() string { return fa.NameVal }

func (fa FilterAdapter) Filter(c *gin.Context, chain FilterChain) {
	fa.Handler(c)
	chain.Next(c)
}

// AdaptHandler converts a gin.HandlerFunc to a Filter.
func AdaptHandler(name string, handler gin.HandlerFunc) Filter {
	return FilterAdapter{NameVal: name, Handler: handler}
}

// AdaptHandlers converts multiple gin.HandlerFunc to a FilterChain.
func AdaptHandlers(namePrefix string, handlers ...gin.HandlerFunc) FilterChain {
	chain := make(FilterChain, len(handlers))
	for i, h := range handlers {
		chain[i] = AdaptHandler(fmt.Sprintf("%s-%d", namePrefix, i), h)
	}
	return chain
}

// TerminatingFilter is a filter that handles the terminal case
// (no next handler in chain).
type TerminatingFilter struct {
	NameVal string
	Handler gin.HandlerFunc
}

func (tf TerminatingFilter) Name() string { return tf.NameVal }

func (tf TerminatingFilter) Filter(c *gin.Context, chain FilterChain) {
	if len(chain) == 0 {
		tf.Handler(c)
	} else {
		chain.Next(c)
	}
}

// ============================================================================
// Concrete Filter Implementations wrapping existing middleware
// ============================================================================

// RateLimitFilter wraps the rate limit middleware as a Filter.
type RateLimitFilter struct {
	limiter ratelimit.Limiter
}

func NewRateLimitFilter(limiter ratelimit.Limiter) *RateLimitFilter {
	return &RateLimitFilter{limiter: limiter}
}

func (f *RateLimitFilter) Name() string { return "rate-limit" }

func (f *RateLimitFilter) Filter(c *gin.Context, chain FilterChain) {
	decision, err := f.limiter.Allow(c.Request.Context(), c.ClientIP())
	if err != nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "rate limit storage unavailable"})
		return
	}
	c.Header("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(decision.ResetAt.Unix(), 10))
	if !decision.Allowed {
		retryAfter := max(int(decision.ResetAt.Sub(time.Now()).Seconds()), 1)
		c.Header("Retry-After", strconv.Itoa(retryAfter))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
		return
	}
	chain.Next(c)
}

// AuditFilter wraps the audit middleware as a Filter.
type AuditFilter struct {
	logger zerolog.Logger
}

func NewAuditFilter(logger zerolog.Logger) *AuditFilter {
	return &AuditFilter{logger: logger}
}

func (f *AuditFilter) Name() string { return "audit" }

func (f *AuditFilter) Filter(c *gin.Context, chain FilterChain) {
	started := time.Now()
	chain.Next(c)
	event := f.logger.Info().
		Str("event", "gateway.audit").
		Str("request_id", c.GetString("request_id")).
		Str("traceparent", c.GetHeader("traceparent")).
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Int("status", c.Writer.Status()).
		Dur("latency", time.Since(started))
	if principal, ok := PrincipalFromContext(c); ok {
		event = event.Str("subject", principal.Subject)
	}
	if tenantID := c.Param("tenantID"); tenantID != "" {
		event = event.Str("tenant_id", tenantID)
	}
	event.Msg("request completed")
}

// LoggingFilter wraps the logging middleware as a Filter.
type LoggingFilter struct {
	logger zerolog.Logger
}

func NewLoggingFilter(logger zerolog.Logger) *LoggingFilter {
	return &LoggingFilter{logger: logger}
}

func (f *LoggingFilter) Name() string { return "logging" }

func (f *LoggingFilter) Filter(c *gin.Context, chain FilterChain) {
	start := time.Now()
	chain.Next(c)
	f.logger.Info().
		Str("method", c.Request.Method).
		Str("path", c.Request.URL.Path).
		Int("status", c.Writer.Status()).
		Dur("latency", time.Since(start)).
		Str("client_ip", c.ClientIP()).
		Msg("request")
}

// CORSFilter wraps the CORS middleware as a Filter.
type CORSFilter struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

func NewCORSFilter(origins, methods, headers []string) *CORSFilter {
	return &CORSFilter{
		AllowedOrigins: origins,
		AllowedMethods: methods,
		AllowedHeaders: headers,
	}
}

func (f *CORSFilter) Name() string { return "cors" }

func (f *CORSFilter) Filter(c *gin.Context, chain FilterChain) {
	origin := c.Request.Header.Get("Origin")
	if origin != "" {
		if !isOriginAllowed(origin, f.AllowedOrigins) {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Credentials", "true")
	}
	c.Header("Access-Control-Allow-Methods", strings.Join(f.AllowedMethods, ", "))
	c.Header("Access-Control-Allow-Headers", strings.Join(f.AllowedHeaders, ", "))
	c.Header("Access-Control-Max-Age", "3600")
	if strings.EqualFold(c.GetHeader("Access-Control-Request-Private-Network"), "true") {
		c.Header("Access-Control-Allow-Private-Network", "true")
	}
	if c.Request.Method == "OPTIONS" {
		c.AbortWithStatus(204)
		return
	}
	chain.Next(c)
}

// TraceFilter wraps the trace context middleware as a Filter.
type TraceFilter struct{}

func NewTraceFilter() *TraceFilter { return &TraceFilter{} }

func (TraceFilter) Name() string { return "trace" }

func (TraceFilter) Filter(c *gin.Context, chain FilterChain) {
	traceparent := c.GetHeader("traceparent")
	if !validTraceparent(traceparent) {
		traceparent = "00-" + randomHex(16) + "-" + randomHex(8) + "-01"
		c.Request.Header.Set("traceparent", traceparent)
	}
	c.Header("traceparent", traceparent)
	chain.Next(c)
}

// RequestIDFilter adds a unique request ID to each request.
type RequestIDFilter struct{}

func NewRequestIDFilter() *RequestIDFilter { return &RequestIDFilter{} }

func (RequestIDFilter) Name() string { return "request-id" }

func (RequestIDFilter) Filter(c *gin.Context, chain FilterChain) {
	requestID := c.GetHeader("X-Request-ID")
	if requestID == "" {
		requestID = generateRequestID()
	}
	c.Set("request_id", requestID)
	c.Header("X-Request-ID", requestID)
	chain.Next(c)
}

// IdentityFilter wraps the identity middleware as a Filter.
type IdentityFilter struct {
	identityService *identity.Service
}

func NewIdentityFilter(service *identity.Service) *IdentityFilter {
	return &IdentityFilter{identityService: service}
}

func (f *IdentityFilter) Name() string { return "identity" }

func (f *IdentityFilter) Filter(c *gin.Context, chain FilterChain) {
	principal, sessionID, err := f.identityService.RestoreSession(c.Request.Context(), c.Request)
	if err == nil {
		f.identityService.SetCookie(c.Writer, sessionID)
		c.Set(PrincipalContextKey, principal)
		chain.Next(c)
		return
	}
	if strings.Contains(err.Error(), "session store unavailable") {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
		return
	}

	// Fallback to bearer token / development headers
	principal, err = f.identityService.AuthenticateHeaderCredentials(c.Request.Context(), c.Request.Header)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Axi OIDC session or bearer token required"})
		return
	}
	c.Set(PrincipalContextKey, principal)
	chain.Next(c)
}

// InternalTokenFilter wraps the internal token middleware as a Filter.
type InternalTokenFilter struct {
	Expected string
}

func NewInternalTokenFilter(expected string) *InternalTokenFilter {
	return &InternalTokenFilter{Expected: expected}
}

func (f *InternalTokenFilter) Name() string { return "internal-token" }

func (f *InternalTokenFilter) Filter(c *gin.Context, chain FilterChain) {
	supplied := strings.TrimSpace(c.GetHeader("X-Axi-Internal-Token"))
	expected := strings.TrimSpace(f.Expected)
	if expected == "" || supplied == "" || !secureCompare(supplied, expected) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "trusted internal credential required"})
		return
	}
	chain.Next(c)
}

// secureCompare performs constant-time string comparison to prevent timing attacks.
func secureCompare(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}
	return result == 0
}

// StripPrefixFilter removes a prefix from the request path.
type StripPrefixFilter struct {
	Prefix string
}

func NewStripPrefixFilter(prefix string) *StripPrefixFilter {
	return &StripPrefixFilter{Prefix: prefix}
}

func (f *StripPrefixFilter) Name() string { return "strip-prefix" }

func (f *StripPrefixFilter) Filter(c *gin.Context, chain FilterChain) {
	path := c.Request.URL.Path
	if strings.HasPrefix(path, f.Prefix) {
		c.Request.URL.Path = strings.TrimPrefix(path, f.Prefix)
	}
	chain.Next(c)
}

// RewritePathFilter rewrites the request path using from/to pattern.
type RewritePathFilter struct {
	From string
	To   string
}

func NewRewritePathFilter(from, to string) *RewritePathFilter {
	return &RewritePathFilter{From: from, To: to}
}

func (f *RewritePathFilter) Name() string { return "rewrite-path" }

func (f *RewritePathFilter) Filter(c *gin.Context, chain FilterChain) {
	path := c.Request.URL.Path
	if strings.HasPrefix(path, f.From) {
		c.Request.URL.Path = f.To + strings.TrimPrefix(path, f.From)
	}
	chain.Next(c)
}

// AddHeaderFilter adds a header to the request.
type AddHeaderFilter struct {
	HeaderName string
	Value      string
}

func NewAddHeaderFilter(name, value string) *AddHeaderFilter {
	return &AddHeaderFilter{HeaderName: name, Value: value}
}

func (f *AddHeaderFilter) Name() string { return "add-header" }

func (f *AddHeaderFilter) Filter(c *gin.Context, chain FilterChain) {
	c.Request.Header.Set(f.HeaderName, f.Value)
	chain.Next(c)
}

// RemoveHeaderFilter removes a header from the request.
type RemoveHeaderFilter struct {
	HeaderName string
}

func NewRemoveHeaderFilter(name string) *RemoveHeaderFilter {
	return &RemoveHeaderFilter{HeaderName: name}
}

func (f *RemoveHeaderFilter) Name() string { return "remove-header" }

func (f *RemoveHeaderFilter) Filter(c *gin.Context, chain FilterChain) {
	c.Request.Header.Del(f.HeaderName)
	chain.Next(c)
}

// SetStatusFilter sets a specific status code (for testing/mock filters).
type SetStatusFilter struct {
	Status int
}

func NewSetStatusFilter(status int) *SetStatusFilter {
	return &SetStatusFilter{Status: status}
}

func (f *SetStatusFilter) Name() string { return "set-status" }

func (f *SetStatusFilter) Filter(c *gin.Context, chain FilterChain) {
	chain.Next(c)
	// Only set if not already set
	if c.Writer.Status() == http.StatusOK {
		c.Writer.WriteHeader(f.Status)
	}
}

// RedirectFilter performs a redirect.
type RedirectFilter struct {
	URL     string
	Permanent bool
}

func NewRedirectFilter(url string, permanent bool) *RedirectFilter {
	return &RedirectFilter{URL: url, Permanent: permanent}
}

func (f *RedirectFilter) Name() string { return "redirect" }

func (f *RedirectFilter) Filter(c *gin.Context, chain FilterChain) {
	status := http.StatusMovedPermanently
	if !f.Permanent {
		status = http.StatusFound
	}
	c.Header("Location", f.URL)
	c.AbortWithStatus(status)
}

// ============================================================================
// Predicate-based Filter Builder
// ============================================================================

// Route defines a predicate-matched route with an ordered filter chain.
type Route struct {
	Name      string
	Predicate Predicate
	Filters   FilterChain
}

// RouteGroup manages a collection of routes.
type RouteGroup struct {
	routes []Route
}

func NewRouteGroup() *RouteGroup {
	return &RouteGroup{}
}

// Add adds a route to the group.
func (g *RouteGroup) Add(route Route) {
	g.routes = append(g.routes, route)
}

// MatchedRoute returns the first route that matches the request, or nil.
func (g *RouteGroup) MatchedRoute(c *gin.Context) *Route {
	for i := range g.routes {
		if g.routes[i].Predicate.Match(c) {
			return &g.routes[i]
		}
	}
	return nil
}

// Apply finds the matching route and applies its filter chain.
// Returns true if a route was matched, false otherwise.
func (g *RouteGroup) Apply(c *gin.Context) bool {
	route := g.MatchedRoute(c)
	if route == nil {
		return false
	}
	route.Filters.Next(c)
	return true
}

// Handler returns a gin.HandlerFunc that applies the route group's logic.
func (g *RouteGroup) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		g.Apply(c)
	}
}

// Builder provides a fluent API for building routes.
type Builder struct {
	group *RouteGroup
}

func NewBuilder() *Builder {
	return &Builder{group: NewRouteGroup()}
}

// Route adds a new route with a predicate and filters.
func (b *Builder) Route(name string, predicate Predicate, filters ...Filter) *Builder {
	b.group.Add(Route{
		Name:      name,
		Predicate: predicate,
		Filters:   filters,
	})
	return b
}

// Build returns the configured RouteGroup.
func (b *Builder) Build() *RouteGroup {
	return b.group
}
