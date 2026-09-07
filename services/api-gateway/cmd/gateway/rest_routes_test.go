package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/epap/api-gateway/handlers"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/ratelimit"
)

func TestRESTSessionResourceAliasesAuthSession(t *testing.T) {
	cfg := testGatewayConfig("http://127.0.0.1:1", 50)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler("http://127.0.0.1:1", "http://127.0.0.1:1", "", "http://127.0.0.1:1", "http://127.0.0.1:1", "http://127.0.0.1:1", "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(50, nil), setupLogger("disabled"))

	session := httptest.NewRecorder()
	router.ServeHTTP(session, httptest.NewRequest(http.MethodGet, "/api/v1/sessions/current", nil))
	if session.Code != http.StatusUnauthorized {
		t.Fatalf("GET /sessions/current = %d", session.Code)
	}

	logout := httptest.NewRecorder()
	router.ServeHTTP(logout, httptest.NewRequest(http.MethodDelete, "/api/v1/sessions/current", nil))
	if logout.Code != http.StatusNoContent {
		t.Fatalf("DELETE /sessions/current = %d", logout.Code)
	}
}

func TestRESTResourceAliasesProxyToNounPaths(t *testing.T) {
	var gotMethod, gotPath string
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		gotMethod = request.Method
		gotPath = request.URL.Path
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"ok":true}`)
	}))
	defer downstream.Close()

	cfg := testGatewayConfig(downstream.URL, 50)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	gateway := httptest.NewServer(setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(50, nil), setupLogger("disabled")))
	defer gateway.Close()

	cases := []struct {
		method string
		path   string
		want   string
	}{
		{http.MethodPatch, "/api/v1/notifications/n-1", "/api/v1/notifications/n-1"},
		{http.MethodPost, "/api/v1/notifications/read-receipts", "/api/v1/notifications/read-receipts"},
		{http.MethodPost, "/api/v1/workflows/w-1/executions", "/workflows/w-1/executions"},
		{http.MethodGet, "/api/v1/workflows/w-1/executions/current", "/workflows/w-1/executions/current"},
		{http.MethodPatch, "/api/v1/workflows/w-1/approvals/a-1", "/workflows/w-1/approvals/a-1"},
		{http.MethodPost, "/api/v1/workflows/w-1/cancellations", "/workflows/w-1/cancellations"},
	}

	for _, testCase := range cases {
		gotMethod, gotPath = "", ""
		request, err := http.NewRequest(testCase.method, gateway.URL+testCase.path, nil)
		if err != nil {
			t.Fatalf("create %s %s: %v", testCase.method, testCase.path, err)
		}
		request.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
		response, err := gateway.Client().Do(request)
		if err != nil {
			t.Fatalf("call %s %s: %v", testCase.method, testCase.path, err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("%s %s status = %d", testCase.method, testCase.path, response.StatusCode)
		}
		if gotMethod != testCase.method || gotPath != testCase.want {
			t.Fatalf("%s %s proxied as %s %s, want %s %s", testCase.method, testCase.path, gotMethod, gotPath, testCase.method, testCase.want)
		}
	}
}
