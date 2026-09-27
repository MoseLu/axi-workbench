package gateway

import (
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDynamicRouter_GetRoutes(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	// Create a simple route matcher
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
    predicates:
      - Method=GET
    filters:
      - RequireIdentity
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	routes := router.GetRoutes()
	assert.Len(t, routes, 1)
	assert.Equal(t, "test-route", routes[0].ID)
	assert.Equal(t, "/api/v1/test", routes[0].Path)
	assert.Equal(t, "http://localhost:8080", routes[0].Upstream)
}

func TestDynamicRouter_AddRoute(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: existing-route
    path: /api/v1/existing
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Add a new route
	newRoute := &config.Route{
		ID:       "new-route",
		Path:     "/api/v1/new",
		Upstream: "http://localhost:8081",
	}
	err = router.AddRoute(newRoute)
	require.NoError(t, err)

	// Verify it's added
	route := router.GetRoute("new-route")
	require.NotNil(t, route)
	assert.Equal(t, "/api/v1/new", route.Path)

	// Verify version incremented
	assert.Equal(t, int64(1), router.GetVersion())
}

func TestDynamicRouter_AddRoute_Duplicate(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: existing-route
    path: /api/v1/existing
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Try to add a route with duplicate ID
	newRoute := &config.Route{
		ID:       "existing-route",
		Path:     "/api/v1/new",
		Upstream: "http://localhost:8081",
	}
	err = router.AddRoute(newRoute)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "route already exists")
}

func TestDynamicRouter_UpdateRoute(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Update the route
	updatedRoute := &config.Route{
		ID:       "test-route",
		Path:     "/api/v1/updated",
		Upstream: "http://localhost:8081",
	}
	err = router.UpdateRoute("test-route", updatedRoute)
	require.NoError(t, err)

	// Verify update
	route := router.GetRoute("test-route")
	require.NotNil(t, route)
	assert.Equal(t, "/api/v1/updated", route.Path)
	assert.Equal(t, "http://localhost:8081", route.Upstream)
}

func TestDynamicRouter_UpdateRoute_NotFound(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Try to update non-existent route
	updatedRoute := &config.Route{
		ID:       "non-existent",
		Path:     "/api/v1/updated",
		Upstream: "http://localhost:8081",
	}
	err = router.UpdateRoute("non-existent", updatedRoute)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "route does not exist")
}

func TestDynamicRouter_DeleteRoute(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Delete the route
	err = router.DeleteRoute("test-route")
	require.NoError(t, err)

	// Verify deletion
	route := router.GetRoute("test-route")
	assert.Nil(t, route)
}

func TestDynamicRouter_DeleteRoute_NotFound(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Try to delete non-existent route
	err = router.DeleteRoute("non-existent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "route does not exist")
}

func TestDynamicRouter_ThreadSafety(t *testing.T) {
	logger := zerolog.New(zerolog.NewTestWriter(t))

	yamlContent := []byte(`
routes:
  - id: initial-route
    path: /api/v1/initial
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	router := NewDynamicRouter(matcher, "/tmp/test.yaml", logger)

	// Concurrent reads and writes
	done := make(chan struct{})
	go func() {
		for i := 0; i < 100; i++ {
			_ = router.GetRoutes()
			_ = router.GetVersion()
			_ = router.GetRoute("initial-route")
			time.Sleep(time.Microsecond)
		}
		done <- struct{}{}
	}()

	go func() {
		for i := 0; i < 100; i++ {
			route := &config.Route{
				ID:       "route-" + string(rune('a'+i%26)),
				Path:     "/api/v1/test-" + string(rune('a'+i%26)),
				Upstream: "http://localhost:8080",
			}
			_ = router.AddRoute(route)
			time.Sleep(time.Microsecond)
		}
		done <- struct{}{}
	}()

	<-done
	<-done

	// Should not panic or deadlock
	t.Log("Concurrent access test passed")
}

func TestRouteError_Error(t *testing.T) {
	err := &RouteError{
		Op:      "add",
		ID:      "test-route",
		Message: "already exists",
	}
	assert.Equal(t, "route add failed for test-route: already exists", err.Error())
}
