package config

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v3"
)

// Route represents a single route configuration (Spring Cloud Gateway style)
type Route struct {
	ID           string   `yaml:"id"`           // Unique route identifier
	Path         string   `yaml:"path"`         // URL path pattern
	Upstream     string   `yaml:"upstream"`      // Target upstream URL (optional)
	UpstreamType string   `yaml:"upstreamType"`  // Upstream type: control-plane, platform, identity, file, workflow, notification (optional)
	Handler      string   `yaml:"handler"`      // Handler name (optional)
	Predicates   []string `yaml:"predicates"`   // Route predicates (e.g., Method=GET)
	Filters      []string `yaml:"filters"`       // Filter names
	Internal     bool     `yaml:"internal"`     // Internal route (requires internal token)
}

// RouteGroup defines common filter combinations
type RouteGroup struct {
	Filters []string `yaml:"filters"`
}

// RoutesConfig represents the complete routes configuration
type RoutesConfig struct {
	Routes      []Route               `yaml:"routes"`
	RouteGroups map[string]RouteGroup `yaml:"routeGroups"`
}

// RouteMatcher provides runtime route matching
type RouteMatcher struct {
	config     *RoutesConfig
	envPattern *regexp.Regexp
	mu         sync.RWMutex
	logger     zerolog.Logger
}

// NewRouteMatcher creates a new route matcher from YAML content
func NewRouteMatcher(yamlContent []byte) (*RouteMatcher, error) {
	var cfg RoutesConfig
	if err := yaml.Unmarshal(yamlContent, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse routes.yaml: %w", err)
	}

	// Expand ENV variable references
	cfg = expandEnvVariables(cfg)

	// Validate routes
	if err := validateRoutes(&cfg); err != nil {
		return nil, fmt.Errorf("invalid routes configuration: %w", err)
	}

	return &RouteMatcher{
		config:     &cfg,
		envPattern: regexp.MustCompile(`\$\{(\w+)\}`),
		logger:     zerolog.New(os.Stdout).With().Str("component", "route_matcher").Logger(),
	}, nil
}

// expandEnvVariables replaces ${ENV_VAR} patterns with actual environment values
func expandEnvVariables(cfg RoutesConfig) RoutesConfig {
	envPattern := regexp.MustCompile(`\$\{(\w+)\}`)

	for i := range cfg.Routes {
		cfg.Routes[i].Upstream = expandEnvString(cfg.Routes[i].Upstream, envPattern)
	}

	return cfg
}

func expandEnvString(s string, pattern *regexp.Regexp) string {
	if s == "" {
		return s
	}

	return pattern.ReplaceAllStringFunc(s, func(match string) string {
		envName := match[2 : len(match)-1] // Extract env var name from ${NAME}
		return os.Getenv(envName)
	})
}

// validateRoutes validates the routes configuration
func validateRoutes(cfg *RoutesConfig) error {
	seen := make(map[string]bool)
	for _, route := range cfg.Routes {
		if route.ID == "" {
			return fmt.Errorf("route missing required 'id' field")
		}
		if route.Path == "" {
			return fmt.Errorf("route %q missing required 'path' field", route.ID)
		}
		if seen[route.ID] {
			return fmt.Errorf("duplicate route id: %q", route.ID)
		}
		seen[route.ID] = true

		// Must have either Handler or Upstream
		if route.Handler == "" && route.Upstream == "" {
			return fmt.Errorf("route %q must have either 'handler' or 'upstream'", route.ID)
		}
	}

	// Validate route groups
	for name, group := range cfg.RouteGroups {
		if len(group.Filters) == 0 {
			return fmt.Errorf("route group %q has no filters defined", name)
		}
	}

	return nil
}

// LoadRoutes loads routes from a YAML file
func LoadRoutes(path string) (*RouteMatcher, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read routes.yaml: %w", err)
	}

	return NewRouteMatcher(data)
}

// Reload reloads the routes configuration from the original file path
// This enables hot-reload capability when called periodically or via signal
func (rm *RouteMatcher) Reload(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read routes.yaml: %w", err)
	}

	newCfg, err := NewRouteMatcher(data)
	if err != nil {
		return err
	}

	rm.mu.Lock()
	rm.config = newCfg.config
	rm.mu.Unlock()

	return nil
}

// UpdateConfig updates the routes configuration (thread-safe).
func (rm *RouteMatcher) UpdateConfig(cfg *RoutesConfig) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// Validate new configuration
	if err := validateRoutes(cfg); err != nil {
		rm.logger.Error().Err(err).Msg("invalid routes configuration update")
		return
	}

	// Expand ENV variable references
	*cfg = expandEnvVariables(*cfg)

	rm.config = cfg
	rm.logger.Info().Int("route_count", len(cfg.Routes)).Msg("routes configuration updated")
}

// GetRoutes returns all configured routes (thread-safe)
func (rm *RouteMatcher) GetRoutes() []Route {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	routes := make([]Route, len(rm.config.Routes))
	copy(routes, rm.config.Routes)
	return routes
}

// GetRouteGroups returns all route groups (thread-safe)
func (rm *RouteMatcher) GetRouteGroups() map[string]RouteGroup {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	groups := make(map[string]RouteGroup, len(rm.config.RouteGroups))
	for k, v := range rm.config.RouteGroups {
		groups[k] = v
	}
	return groups
}

// GetRouteByID retrieves a route by its ID
func (rm *RouteMatcher) GetRouteByID(id string) *Route {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	for i := range rm.config.Routes {
		if rm.config.Routes[i].ID == id {
			return &rm.config.Routes[i]
		}
	}
	return nil
}

// ParsePredicate parses a predicate string like "Method=GET" or "Path=/api/**"
func ParsePredicate(predicate string) (predicateType, value string, err error) {
	parts := strings.SplitN(predicate, "=", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid predicate format: %q", predicate)
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
}

// ParseFilter parses a filter string like "StripPrefix=3" or "RateLimit=mobile"
func ParseFilter(filter string) (filterName string, args []string) {
	parts := strings.SplitN(filter, "=", 2)
	name := strings.TrimSpace(parts[0])
	if len(parts) == 2 {
		// Handle comma-separated arguments
		for _, arg := range strings.Split(parts[1], ",") {
			arg = strings.TrimSpace(arg)
			if arg != "" {
				args = append(args, arg)
			}
		}
	}
	return name, args
}

// ParseMethodPredicate extracts HTTP methods from predicates
func ParseMethodPredicate(predicates []string) []string {
	var methods []string
	for _, p := range predicates {
		pType, value, _ := ParsePredicate(p)
		if pType == "Method" {
			for _, m := range strings.Split(value, ",") {
				m = strings.TrimSpace(strings.ToUpper(m))
				if m != "" {
					methods = append(methods, m)
				}
			}
		}
	}
	return methods
}

// RouteMatchContext contains context for route matching
type RouteMatchContext struct {
	Path   string
	Method string
}

// Matches checks if this route matches the given context
func (r *Route) Matches(ctx RouteMatchContext) bool {
	// Check method predicate
	methods := ParseMethodPredicate(r.Predicates)
	if len(methods) > 0 {
		methodMatch := false
		for _, m := range methods {
			if m == ctx.Method {
				methodMatch = true
				break
			}
		}
		if !methodMatch {
			return false
		}
	}

	// Check path pattern (simple prefix/wildcard matching)
	if !matchPath(r.Path, ctx.Path) {
		return false
	}

	return true
}

// matchPath performs simple path pattern matching with wildcards
func matchPath(pattern, path string) bool {
	// Exact match
	if pattern == path {
		return true
	}

	// Wildcard suffix match
	if strings.HasSuffix(pattern, "/**") {
		prefix := strings.TrimSuffix(pattern, "/**")
		return strings.HasPrefix(path, prefix)
	}

	// Single level wildcard
	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		rest := strings.TrimPrefix(path, prefix)
		// Rest should not contain more path segments
		return !strings.Contains(rest[1:], "/")
	}

	return false
}

// FilterConfig holds parsed filter configuration
type FilterConfig struct {
	Name string
	Args []string
}

// GetStripPrefixArgs extracts the strip prefix count from filters
func GetStripPrefixArgs(filters []string) int {
	for _, f := range filters {
		name, args := ParseFilter(f)
		if name == "StripPrefix" && len(args) > 0 {
			if n, err := strconv.Atoi(args[0]); err == nil {
				return n
			}
		}
	}
	return 0
}

// HasFilter checks if a specific filter is present
func HasFilter(filters []string, filterName string) bool {
	for _, f := range filters {
		name, _ := ParseFilter(f)
		if name == filterName {
			return true
		}
	}
	return false
}

// GetRateLimitArgs extracts rate limit group from filters
func GetRateLimitArgs(filters []string) string {
	for _, f := range filters {
		name, args := ParseFilter(f)
		if name == "RateLimit" && len(args) > 0 {
			return args[0]
		}
	}
	return ""
}
