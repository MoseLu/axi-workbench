package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadRoutes(t *testing.T) {
	// Create a temporary routes.yaml file
	tmpDir := t.TempDir()
	routesPath := filepath.Join(tmpDir, "routes.yaml")

	routesYaml := `
routes:
  - id: health
    path: /health
    handler: HealthCheck
    predicates:
      - Method=GET
    filters: []

  - id: auth-session
    path: /api/v1/auth/session
    handler: Session
    predicates:
      - Method=GET
    filters:
      - Audit

  - id: mobile-proxy
    path: /api/v1/mobile/**
    upstream: ${CONTROL_PLANE_URL}
    predicates:
      - Method=POST,GET
    filters:
      - StripPrefix=3
      - RateLimit=mobile
`

	if err := os.WriteFile(routesPath, []byte(routesYaml), 0644); err != nil {
		t.Fatalf("failed to write routes.yaml: %v", err)
	}

	// Set environment variable for expansion
	os.Setenv("CONTROL_PLANE_URL", "http://control-plane:8092")
	defer os.Unsetenv("CONTROL_PLANE_URL")

	// Load routes
	matcher, err := LoadRoutes(routesPath)
	if err != nil {
		t.Fatalf("failed to load routes: %v", err)
	}

	// Verify routes were loaded
	routes := matcher.GetRoutes()
	if len(routes) != 3 {
		t.Errorf("expected 3 routes, got %d", len(routes))
	}

	// Verify route by ID
	route := matcher.GetRouteByID("health")
	if route == nil {
		t.Fatal("expected to find health route")
	}
	if route.Path != "/health" {
		t.Errorf("expected path /health, got %s", route.Path)
	}
	if route.Handler != "HealthCheck" {
		t.Errorf("expected handler HealthCheck, got %s", route.Handler)
	}

	// Verify upstream expansion
	mobileRoute := matcher.GetRouteByID("mobile-proxy")
	if mobileRoute == nil {
		t.Fatal("expected to find mobile-proxy route")
	}
	if mobileRoute.Upstream != "http://control-plane:8092" {
		t.Errorf("expected upstream http://control-plane:8092, got %s", mobileRoute.Upstream)
	}
}

func TestParsePredicate(t *testing.T) {
	tests := []struct {
		input    string
		expected string
		value    string
	}{
		{"Method=GET", "Method", "GET"},
		{"Method=POST,GET", "Method", "POST,GET"},
		{"Path=/api/**", "Path", "/api/**"},
	}

	for _, tt := range tests {
		pType, value, err := ParsePredicate(tt.input)
		if err != nil {
			t.Errorf("unexpected error for %s: %v", tt.input, err)
			continue
		}
		if pType != tt.expected {
			t.Errorf("expected type %s, got %s", tt.expected, pType)
		}
		if value != tt.value {
			t.Errorf("expected value %s, got %s", tt.value, value)
		}
	}
}

func TestParseFilter(t *testing.T) {
	name, args := ParseFilter("StripPrefix=3")
	if name != "StripPrefix" {
		t.Errorf("expected name StripPrefix, got %s", name)
	}
	if len(args) != 1 || args[0] != "3" {
		t.Errorf("expected args [3], got %v", args)
	}

	name, args = ParseFilter("RateLimit=mobile")
	if name != "RateLimit" {
		t.Errorf("expected name RateLimit, got %s", name)
	}
	if len(args) != 1 || args[0] != "mobile" {
		t.Errorf("expected args [mobile], got %v", args)
	}

	name, args = ParseFilter("RequireIdentity")
	if name != "RequireIdentity" {
		t.Errorf("expected name RequireIdentity, got %s", name)
	}
	if len(args) != 0 {
		t.Errorf("expected no args, got %v", args)
	}
}

func TestParseMethodPredicate(t *testing.T) {
	predicates := []string{"Method=GET", "Path=/api/**"}

	methods := ParseMethodPredicate(predicates)
	if len(methods) != 1 || methods[0] != "GET" {
		t.Errorf("expected [GET], got %v", methods)
	}

	predicates = []string{"Method=POST,GET"}
	methods = ParseMethodPredicate(predicates)
	if len(methods) != 2 {
		t.Errorf("expected 2 methods, got %d", len(methods))
	}
}

func TestValidateRoutes(t *testing.T) {
	// Test missing id
	cfg := &RoutesConfig{
		Routes: []Route{
			{Path: "/test", Handler: "Test"},
		},
	}
	if err := validateRoutes(cfg); err == nil {
		t.Error("expected error for missing route id")
	}

	// Test duplicate id
	cfg = &RoutesConfig{
		Routes: []Route{
			{ID: "test", Path: "/test1", Handler: "Test"},
			{ID: "test", Path: "/test2", Handler: "Test"},
		},
	}
	if err := validateRoutes(cfg); err == nil {
		t.Error("expected error for duplicate route id")
	}

	// Test missing path
	cfg = &RoutesConfig{
		Routes: []Route{
			{ID: "test", Handler: "Test"},
		},
	}
	if err := validateRoutes(cfg); err == nil {
		t.Error("expected error for missing path")
	}

	// Test missing handler and upstream
	cfg = &RoutesConfig{
		Routes: []Route{
			{ID: "test", Path: "/test"},
		},
	}
	if err := validateRoutes(cfg); err == nil {
		t.Error("expected error for missing handler and upstream")
	}
}

func TestRouteMatching(t *testing.T) {
	route := &Route{
		ID:         "test",
		Path:       "/api/v1/users",
		Predicates: []string{"Method=GET,POST"},
	}

	ctx := RouteMatchContext{Path: "/api/v1/users", Method: "GET"}
	if !route.Matches(ctx) {
		t.Error("expected route to match GET /api/v1/users")
	}

	ctx = RouteMatchContext{Path: "/api/v1/users", Method: "DELETE"}
	if route.Matches(ctx) {
		t.Error("expected route NOT to match DELETE /api/v1/users")
	}
}
