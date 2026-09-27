package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/gateway"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// AdminHandler provides administrative endpoints for route management.
type AdminHandler struct {
	dynamicRouter *gateway.DynamicRouter
	internalToken string
	logger        zerolog.Logger
}

// NewAdminHandler creates a new admin handler.
func NewAdminHandler(dynamicRouter *gateway.DynamicRouter, internalToken string, logger zerolog.Logger) *AdminHandler {
	return &AdminHandler{
		dynamicRouter: dynamicRouter,
		internalToken: internalToken,
		logger:        logger,
	}
}

// RegisterRoutes registers the admin routes to the gin router.
func (ah *AdminHandler) RegisterRoutes(router *gin.RouterGroup) {
	admin := router.Group("/admin")
	admin.Use(requireInternalToken(ah.internalToken))
	{
		admin.POST("/routes/reload", ah.ReloadRoutes)
		admin.GET("/routes", ah.ListRoutes)
		admin.GET("/routes/:id", ah.GetRoute)
		admin.PUT("/routes/:id", ah.UpdateRoute)
		admin.DELETE("/routes/:id", ah.DeleteRoute)
		admin.POST("/routes", ah.AddRoute)
		admin.GET("/routes/stats", ah.GetRouteStats)
	}
}

// requireInternalToken creates a middleware that requires a valid internal token.
func requireInternalToken(expected string) gin.HandlerFunc {
	return func(c *gin.Context) {
		supplied := c.GetHeader("X-Axi-Internal-Token")
		if supplied != expected {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	}
}

// ReloadRoutes handles POST /admin/routes/reload
// Reloads routes from the configuration file.
func (ah *AdminHandler) ReloadRoutes(c *gin.Context) {
	if err := ah.dynamicRouter.ReloadConfig(); err != nil {
		ah.logger.Error().Err(err).Msg("failed to reload routes")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "reload_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "reloaded",
		"version": ah.dynamicRouter.GetVersion(),
		"routes":  ah.dynamicRouter.GetRoutes(),
	})
}

// ListRoutes handles GET /admin/routes
// Returns all registered routes.
func (ah *AdminHandler) ListRoutes(c *gin.Context) {
	routes := ah.dynamicRouter.GetRoutes()
	c.JSON(http.StatusOK, gin.H{
		"routes":  routes,
		"count":   len(routes),
		"version": ah.dynamicRouter.GetVersion(),
	})
}

// GetRoute handles GET /admin/routes/:id
// Returns a specific route by ID.
func (ah *AdminHandler) GetRoute(c *gin.Context) {
	id := c.Param("id")
	route := ah.dynamicRouter.GetRoute(id)
	if route == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "route_not_found",
			"message": "route with id " + id + " not found",
		})
		return
	}

	c.JSON(http.StatusOK, route)
}

// RouteUpdateRequest represents a request to update a route.
type RouteUpdateRequest struct {
	Path       string   `json:"path"`
	Upstream   string   `json:"upstream,omitempty"`
	Handler    string   `json:"handler,omitempty"`
	Predicates []string `json:"predicates,omitempty"`
	Filters    []string `json:"filters,omitempty"`
	Internal   bool     `json:"internal"`
}

// AddRoute handles POST /admin/routes
// Adds a new route.
func (ah *AdminHandler) AddRoute(c *gin.Context) {
	var req RouteUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	routeID := c.GetHeader("X-Route-ID")
	if routeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_route_id",
			"message": "X-Route-ID header is required",
		})
		return
	}

	route := &config.Route{
		ID:         routeID,
		Path:       req.Path,
		Upstream:   req.Upstream,
		Handler:    req.Handler,
		Predicates: req.Predicates,
		Filters:    req.Filters,
		Internal:   req.Internal,
	}

	if err := ah.dynamicRouter.AddRoute(route); err != nil {
		ah.logger.Error().Err(err).Str("route_id", routeID).Msg("failed to add route")
		c.JSON(http.StatusConflict, gin.H{
			"error":   "route_exists",
			"message": err.Error(),
		})
		return
	}

	ah.logger.Info().Str("route_id", routeID).Msg("route added via admin API")
	c.JSON(http.StatusCreated, ah.dynamicRouter.GetRoute(routeID))
}

// UpdateRoute handles PUT /admin/routes/:id
// Updates an existing route.
func (ah *AdminHandler) UpdateRoute(c *gin.Context) {
	id := c.Param("id")

	var req RouteUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	route := &config.Route{
		ID:         id,
		Path:       req.Path,
		Upstream:   req.Upstream,
		Handler:    req.Handler,
		Predicates: req.Predicates,
		Filters:    req.Filters,
		Internal:   req.Internal,
	}

	if err := ah.dynamicRouter.UpdateRoute(id, route); err != nil {
		ah.logger.Error().Err(err).Str("route_id", id).Msg("failed to update route")
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "route_not_found",
			"message": err.Error(),
		})
		return
	}

	ah.logger.Info().Str("route_id", id).Msg("route updated via admin API")
	c.JSON(http.StatusOK, ah.dynamicRouter.GetRoute(id))
}

// DeleteRoute handles DELETE /admin/routes/:id
// Deletes a route.
func (ah *AdminHandler) DeleteRoute(c *gin.Context) {
	id := c.Param("id")

	if err := ah.dynamicRouter.DeleteRoute(id); err != nil {
		ah.logger.Error().Err(err).Str("route_id", id).Msg("failed to delete route")
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "route_not_found",
			"message": err.Error(),
		})
		return
	}

	ah.logger.Info().Str("route_id", id).Msg("route deleted via admin API")
	c.JSON(http.StatusOK, gin.H{
		"status":  "deleted",
		"route_id": id,
	})
}

// RouteStatsResponse represents route statistics.
type RouteStatsResponse struct {
	TotalRoutes    int      `json:"total_routes"`
	UpstreamRoutes int      `json:"upstream_routes"`
	HandlerRoutes  int      `json:"handler_routes"`
	InternalRoutes int      `json:"internal_routes"`
	Version        int64    `json:"version"`
	RouteIDs       []string `json:"route_ids"`
}

// GetRouteStats handles GET /admin/routes/stats
// Returns statistics about registered routes.
func (ah *AdminHandler) GetRouteStats(c *gin.Context) {
	routes := ah.dynamicRouter.GetRoutes()

	stats := RouteStatsResponse{
		TotalRoutes: len(routes),
		Version:     ah.dynamicRouter.GetVersion(),
		RouteIDs:    make([]string, 0, len(routes)),
	}

	for _, r := range routes {
		stats.RouteIDs = append(stats.RouteIDs, r.ID)
		if r.Internal {
			stats.InternalRoutes++
		}
		if r.Upstream != "" {
			stats.UpstreamRoutes++
		} else {
			stats.HandlerRoutes++
		}
	}

	c.JSON(http.StatusOK, stats)
}

// AdminResponse represents a standard admin API response.
type AdminResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// JSONResponse sends a JSON response with the given status code.
func JSONResponse(c *gin.Context, status int, response AdminResponse) {
	c.JSON(status, response)
}

// ParseJSON parses JSON from the request body.
func ParseJSON(c *gin.Context, v interface{}) error {
	return json.NewDecoder(c.Request.Body).Decode(v)
}
