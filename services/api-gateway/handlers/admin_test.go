package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/gateway"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRouter(t *testing.T, matcher *config.RouteMatcher, configPath string) (*gin.Engine, *gateway.DynamicRouter) {
	logger := zerolog.New(zerolog.NewTestWriter(t))
	router := gateway.NewDynamicRouter(matcher, configPath, logger)
	adminHandler := NewAdminHandler(router, "test-token", logger)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	adminHandler.RegisterRoutes(r.Group("/api/v1"))

	return r, router
}

func TestAdminHandler_ReloadRoutes(t *testing.T) {
	// Create a temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "routes.yaml")

	initialContent := `
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`
	err := os.WriteFile(configPath, []byte(initialContent), 0644)
	require.NoError(t, err)

	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, configPath)

	req, _ := http.NewRequest("POST", "/api/v1/admin/routes/reload", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "reloaded", response["status"])
}

func TestAdminHandler_ReloadRoutes_Unauthorized(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("POST", "/api/v1/admin/routes/reload", nil)
	req.Header.Set("X-Axi-Internal-Token", "wrong-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAdminHandler_ListRoutes(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
  - id: another-route
    path: /api/v1/another
    upstream: http://localhost:8081
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("GET", "/api/v1/admin/routes", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, float64(2), response["count"])
}

func TestAdminHandler_GetRoute(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("GET", "/api/v1/admin/routes/test-route", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var route gateway.Route
	err = json.Unmarshal(w.Body.Bytes(), &route)
	require.NoError(t, err)
	assert.Equal(t, "test-route", route.ID)
	assert.Equal(t, "/api/v1/test", route.Path)
}

func TestAdminHandler_GetRoute_NotFound(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("GET", "/api/v1/admin/routes/non-existent", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdminHandler_AddRoute(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: existing-route
    path: /api/v1/existing
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	body := `{"path": "/api/v1/new", "upstream": "http://localhost:8081"}`
	req, _ := http.NewRequest("POST", "/api/v1/admin/routes", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Route-ID", "new-route")
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var route gateway.Route
	err = json.Unmarshal(w.Body.Bytes(), &route)
	require.NoError(t, err)
	assert.Equal(t, "new-route", route.ID)
	assert.Equal(t, "/api/v1/new", route.Path)
}

func TestAdminHandler_AddRoute_MissingID(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: existing-route
    path: /api/v1/existing
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	body := `{"path": "/api/v1/new", "upstream": "http://localhost:8081"}`
	req, _ := http.NewRequest("POST", "/api/v1/admin/routes", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAdminHandler_UpdateRoute(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	body := `{"path": "/api/v1/updated", "upstream": "http://localhost:8081"}`
	req, _ := http.NewRequest("PUT", "/api/v1/admin/routes/test-route", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var route gateway.Route
	err = json.Unmarshal(w.Body.Bytes(), &route)
	require.NoError(t, err)
	assert.Equal(t, "test-route", route.ID)
	assert.Equal(t, "/api/v1/updated", route.Path)
}

func TestAdminHandler_DeleteRoute(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("DELETE", "/api/v1/admin/routes/test-route", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "deleted", response["status"])
	assert.Equal(t, "test-route", response["route_id"])

	// Verify it's gone
	getReq, _ := http.NewRequest("GET", "/api/v1/admin/routes/test-route", nil)
	getReq.Header.Set("X-Axi-Internal-Token", "test-token")
	getW := httptest.NewRecorder()
	r.ServeHTTP(getW, getReq)
	assert.Equal(t, http.StatusNotFound, getW.Code)
}

func TestAdminHandler_GetStats(t *testing.T) {
	yamlContent := []byte(`
routes:
  - id: upstream-route
    path: /api/v1/upstream
    upstream: http://localhost:8080
  - id: handler-route
    path: /api/v1/handler
    handler: HealthCheck
  - id: internal-route
    path: /internal/v1/secret
    upstream: http://localhost:8080
    internal: true
`)
	matcher, err := config.NewRouteMatcher(yamlContent)
	require.NoError(t, err)

	r, _ := setupTestRouter(t, matcher, "/tmp/test.yaml")

	req, _ := http.NewRequest("GET", "/api/v1/admin/routes/stats", nil)
	req.Header.Set("X-Axi-Internal-Token", "test-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stats RouteStatsResponse
	err = json.Unmarshal(w.Body.Bytes(), &stats)
	require.NoError(t, err)
	assert.Equal(t, 3, stats.TotalRoutes)
	assert.Equal(t, 2, stats.UpstreamRoutes)
	assert.Equal(t, 1, stats.HandlerRoutes)
	assert.Equal(t, 1, stats.InternalRoutes)
}
