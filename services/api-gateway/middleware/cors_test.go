package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSOnlyAllowsExplicitOriginsWithCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS([]string{"https://web.axi.example.com"}, []string{"GET"}, []string{"Content-Type"}))
	router.GET("/api/v1/auth/session", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	allowed := httptest.NewRecorder()
	allowedRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	allowedRequest.Header.Set("Origin", "https://web.axi.example.com")
	router.ServeHTTP(allowed, allowedRequest)
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "https://web.axi.example.com" {
		t.Fatalf("allowed origin = %q", got)
	}
	if got := allowed.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("credentials header = %q", got)
	}

	blocked := httptest.NewRecorder()
	blockedRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	blockedRequest.Header.Set("Origin", "https://evil.example.com")
	router.ServeHTTP(blocked, blockedRequest)
	if blocked.Code != http.StatusForbidden {
		t.Fatalf("blocked status = %d, want %d", blocked.Code, http.StatusForbidden)
	}
}

func TestCORSAllowsPrivateNetworkPreflightWhenRequested(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(CORS([]string{"http://tauri.localhost"}, []string{"POST"}, []string{"Content-Type"}))
	router.POST("/api/v1/auth/device-login/qr", func(c *gin.Context) { c.Status(http.StatusOK) })

	preflight := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/device-login/qr", nil)
	request.Header.Set("Origin", "http://tauri.localhost")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "content-type")
	request.Header.Set("Access-Control-Request-Private-Network", "true")
	router.ServeHTTP(preflight, request)

	if preflight.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want %d", preflight.Code, http.StatusNoContent)
	}
	if got := preflight.Header().Get("Access-Control-Allow-Private-Network"); got != "true" {
		t.Fatalf("private network header = %q, want true", got)
	}
}
