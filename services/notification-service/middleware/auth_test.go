package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"notification-service/config"
)

func TestRequireGatewayIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name       string
		token      string
		subject    string
		wantStatus int
	}{
		{name: "missing token", subject: "alice", wantStatus: http.StatusUnauthorized},
		{name: "wrong token", token: "wrong", subject: "alice", wantStatus: http.StatusUnauthorized},
		{name: "missing subject", token: "notification-test-token", wantStatus: http.StatusUnauthorized},
		{name: "trusted request", token: "notification-test-token", subject: "alice", wantStatus: http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(RequireGatewayIdentity(&config.Config{InternalServiceToken: "notification-test-token"}))
			router.GET("/", func(c *gin.Context) {
				if got := Subject(c); got != tt.subject {
					t.Errorf("subject = %q, want %q", got, tt.subject)
				}
				c.Status(http.StatusNoContent)
			})
			request := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.token != "" {
				request.Header.Set("X-Axi-Internal-Token", tt.token)
			}
			if tt.subject != "" {
				request.Header.Set("X-Axi-Subject", tt.subject)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
		})
	}
}

func TestRequireInternalEventDoesNotRequireSubject(t *testing.T) {
	router := gin.New()
	router.POST("/internal/events", RequireInternalEvent(&config.Config{InternalServiceToken: "event-token"}), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/internal/events", nil)
	request.Header.Set("X-Axi-Internal-Token", "event-token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("event status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
}
