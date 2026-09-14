package gateway

import (
	"context"
	"sync"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/rs/zerolog"
)

// DynamicRouter provides thread-safe dynamic route management with hot-reload capability.
// Inspired by Spring Cloud Gateway's RouteDefinitionLocator and RouteRefreshListener.
type DynamicRouter struct {
	mu         sync.RWMutex
	routes     map[string]*config.Route
	matcher    *config.RouteMatcher
	configPath string
	logger     zerolog.Logger
	watcher    *config.ConfigWatcher
	version    int64 // incremented on each route change
}

// Route represents a runtime route with additional metadata.
type Route struct {
	ID         string   `json:"id"`
	Path       string   `json:"path"`
	Upstream   string   `json:"upstream,omitempty"`
	Handler    string   `json:"handler,omitempty"`
	Predicates []string `json:"predicates,omitempty"`
	Filters    []string `json:"filters,omitempty"`
	Internal   bool     `json:"internal"`
	Version    int64    `json:"version"`
}

// NewDynamicRouter creates a new DynamicRouter with the given configuration.
func NewDynamicRouter(
	matcher *config.RouteMatcher,
	configPath string,
	logger zerolog.Logger,
) *DynamicRouter {
	dr := &DynamicRouter{
		routes:     make(map[string]*config.Route),
		matcher:    matcher,
		configPath: configPath,
		logger:     logger,
	}

	// Initialize routes from matcher
	routes := matcher.GetRoutes()
	for i := range routes {
		dr.routes[routes[i].ID] = &routes[i]
	}

	return dr
}

// GetRoutes returns all current routes (thread-safe).
func (dr *DynamicRouter) GetRoutes() []Route {
	dr.mu.RLock()
	defer dr.mu.RUnlock()

	result := make([]Route, 0, len(dr.routes))
	for _, r := range dr.routes {
		result = append(result, Route{
			ID:         r.ID,
			Path:       r.Path,
			Upstream:   r.Upstream,
			Handler:    r.Handler,
			Predicates: r.Predicates,
			Filters:    r.Filters,
			Internal:   r.Internal,
			Version:    dr.version,
		})
	}
	return result
}

// GetRoute returns a route by ID (thread-safe).
func (dr *DynamicRouter) GetRoute(id string) *Route {
	dr.mu.RLock()
	defer dr.mu.RUnlock()

	if r, ok := dr.routes[id]; ok {
		return &Route{
			ID:         r.ID,
			Path:       r.Path,
			Upstream:   r.Upstream,
			Handler:    r.Handler,
			Predicates: r.Predicates,
			Filters:    r.Filters,
			Internal:   r.Internal,
			Version:    dr.version,
		}
	}
	return nil
}

// AddRoute adds a new route (thread-safe).
// Returns error if route ID already exists.
func (dr *DynamicRouter) AddRoute(route *config.Route) error {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	if _, exists := dr.routes[route.ID]; exists {
		return &RouteError{Op: "add", ID: route.ID, Message: "route already exists"}
	}

	dr.routes[route.ID] = route
	dr.version++

	dr.logger.Info().
		Str("route_id", route.ID).
		Str("path", route.Path).
		Int64("version", dr.version).
		Msg("route added")

	return nil
}

// UpdateRoute updates an existing route (thread-safe).
// Returns error if route ID does not exist.
func (dr *DynamicRouter) UpdateRoute(id string, route *config.Route) error {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	if _, exists := dr.routes[id]; !exists {
		return &RouteError{Op: "update", ID: id, Message: "route does not exist"}
	}

	// Ensure ID cannot be changed
	route.ID = id
	dr.routes[id] = route
	dr.version++

	dr.logger.Info().
		Str("route_id", id).
		Str("path", route.Path).
		Int64("version", dr.version).
		Msg("route updated")

	return nil
}

// DeleteRoute removes a route by ID (thread-safe).
// Returns error if route ID does not exist.
func (dr *DynamicRouter) DeleteRoute(id string) error {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	if _, exists := dr.routes[id]; !exists {
		return &RouteError{Op: "delete", ID: id, Message: "route does not exist"}
	}

	delete(dr.routes, id)
	dr.version++

	dr.logger.Info().
		Str("route_id", id).
		Int64("version", dr.version).
		Msg("route deleted")

	return nil
}

// ReloadConfig reloads routes from the configuration file.
func (dr *DynamicRouter) ReloadConfig() error {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	dr.logger.Info().Str("path", dr.configPath).Msg("reloading route configuration")

	if err := dr.matcher.Reload(dr.configPath); err != nil {
		return err
	}

	// Update internal route map
	routes := dr.matcher.GetRoutes()
	dr.routes = make(map[string]*config.Route, len(routes))
	for i := range routes {
		dr.routes[routes[i].ID] = &routes[i]
	}
	dr.version++

	dr.logger.Info().
		Int("route_count", len(routes)).
		Int64("version", dr.version).
		Msg("route configuration reloaded")

	return nil
}

// GetVersion returns the current route version.
func (dr *DynamicRouter) GetVersion() int64 {
	dr.mu.RLock()
	defer dr.mu.RUnlock()
	return dr.version
}

// StartWatcher starts the configuration file watcher.
func (dr *DynamicRouter) StartWatcher(ctx context.Context) error {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	if dr.watcher != nil {
		return nil // Already watching
	}

	watcher, err := config.NewConfigWatcher(dr.configPath, 5*time.Second, func(cfg *config.RoutesConfig) {
		dr.mu.Lock()
		defer dr.mu.Unlock()

		dr.logger.Info().Msg("configuration change detected, updating routes")

		// Update matcher
		dr.matcher.UpdateConfig(cfg)

		// Update internal route map
		dr.routes = make(map[string]*config.Route, len(cfg.Routes))
		for i := range cfg.Routes {
			dr.routes[cfg.Routes[i].ID] = &cfg.Routes[i]
		}
		dr.version++

		dr.logger.Info().
			Int("route_count", len(cfg.Routes)).
			Int64("version", dr.version).
			Msg("routes updated from file watcher")
	})
	if err != nil {
		return err
	}

	dr.watcher = watcher
	watcher.Start(ctx)

	dr.logger.Info().Msg("configuration watcher started")

	return nil
}

// StopWatcher stops the configuration file watcher.
func (dr *DynamicRouter) StopWatcher() {
	dr.mu.Lock()
	defer dr.mu.Unlock()

	if dr.watcher != nil {
		dr.watcher.Stop()
		dr.watcher = nil
	}
}

// RouteError represents a route operation error.
type RouteError struct {
	Op      string
	ID      string
	Message string
}

func (e *RouteError) Error() string {
	return "route " + e.Op + " failed for " + e.ID + ": " + e.Message
}

// Upstream represents a target service configuration.
type Upstream struct {
	URL      string
	Metadata map[string]string
}
