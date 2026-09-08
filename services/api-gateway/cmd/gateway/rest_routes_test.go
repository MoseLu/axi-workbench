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

func TestRESTLoginActionAliasesStayOnPublicSessionResources(t *testing.T) {
	cfg := testGatewayConfig("http://127.0.0.1:1", 50)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler("http://127.0.0.1:1", "http://127.0.0.1:1", "", "http://127.0.0.1:1", "http://127.0.0.1:1", "http://127.0.0.1:1", "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(50, nil), setupLogger("disabled"))

	emailRPC := httptest.NewRecorder()
	router.ServeHTTP(emailRPC, httptest.NewRequest(http.MethodPost, "/api/v1/auth/login/email/confirm", nil))
	emailREST := httptest.NewRecorder()
	router.ServeHTTP(emailREST, httptest.NewRequest(http.MethodPost, "/api/v1/sessions/email", nil))
	if emailRPC.Code != http.StatusBadRequest || emailREST.Code != emailRPC.Code {
		t.Fatalf("email login RPC/REST = %d/%d", emailRPC.Code, emailREST.Code)
	}

	consumeRPC := httptest.NewRecorder()
	router.ServeHTTP(consumeRPC, httptest.NewRequest(http.MethodPost, "/api/v1/auth/device-login/qr/weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d/consume", nil))
	consumeREST := httptest.NewRecorder()
	router.ServeHTTP(consumeREST, httptest.NewRequest(http.MethodPost, "/api/v1/sessions/device-qr/weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d", nil))
	if consumeRPC.Code != http.StatusBadRequest || consumeREST.Code != consumeRPC.Code {
		t.Fatalf("device QR consume RPC/REST = %d/%d", consumeRPC.Code, consumeREST.Code)
	}
}

func TestControlPlaneAndMobileCatchAllsAreExplicitAllowlists(t *testing.T) {
	var gotMethod, gotPath string
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		gotMethod = request.Method
		gotPath = request.URL.Path
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"ok":true}`)
	}))
	defer downstream.Close()

	cfg := testGatewayConfig(downstream.URL, 50)
	cfg.Services.ControlPlaneURL = downstream.URL
	cfg.Services.ControlPlaneInternalToken = "control-plane-test-token"
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	gateway := httptest.NewServer(setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(50, nil), setupLogger("disabled")))
	defer gateway.Close()

	allowed := []struct {
		method string
		path   string
		want   string
		auth   bool
	}{
		{http.MethodGet, "/api/v1/control-plane/snapshot", "/internal/web/v1/snapshot", true},
		{http.MethodPost, "/api/v1/control-plane/jobs/j-1/cancellations", "/internal/web/v1/jobs/j-1/cancellations", true},
		{http.MethodPost, "/api/v1/control-plane/approvals/a-1/decisions", "/internal/web/v1/approvals/a-1/decisions", true},
		{http.MethodPost, "/api/v1/control-plane/commands/c-1/runs", "/internal/web/v1/commands/c-1/runs", true},
		{http.MethodGet, "/api/v1/mobile/workspace", "/internal/mobile/v1/workspace", false},
		{http.MethodPost, "/api/v1/mobile/pair/confirmations", "/internal/mobile/v1/pair/confirmations", false},
		{http.MethodPost, "/api/v1/mobile/jobs/j-1/cancellations", "/internal/mobile/v1/jobs/j-1/cancellations", false},
		{http.MethodPost, "/api/v1/auth/email-verifications/ch-1/redemptions", "/api/v1/auth/email-verifications/ch-1/redemptions", false},
		{http.MethodPost, "/api/v1/auth/qr/transactions/qr-1/resumptions", "/api/v1/auth/qr/transactions/qr-1/resumptions", false},
	}
	for _, testCase := range allowed {
		gotMethod, gotPath = "", ""
		request, err := http.NewRequest(testCase.method, gateway.URL+testCase.path, nil)
		if err != nil {
			t.Fatalf("create %s %s: %v", testCase.method, testCase.path, err)
		}
		if testCase.auth {
			request.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
		}
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

	blocked := []struct {
		method string
		path   string
	}{
		{http.MethodConnect, "/api/v1/control-plane/snapshot"},
		{http.MethodTrace, "/api/v1/mobile/workspace"},
		{http.MethodDelete, "/api/v1/control-plane/snapshot"},
		{http.MethodGet, "/api/v1/control-plane/not-allowlisted"},
		{http.MethodPost, "/api/v1/mobile/not-allowlisted"},
	}
	for _, testCase := range blocked {
		gotMethod, gotPath = "leaked", "leaked"
		request, err := http.NewRequest(testCase.method, gateway.URL+testCase.path, nil)
		if err != nil {
			t.Fatalf("create blocked %s %s: %v", testCase.method, testCase.path, err)
		}
		request.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
		response, err := gateway.Client().Do(request)
		if err != nil {
			t.Fatalf("call blocked %s %s: %v", testCase.method, testCase.path, err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusNotFound {
			t.Fatalf("blocked %s %s status = %d, want 404", testCase.method, testCase.path, response.StatusCode)
		}
		if gotPath != "leaked" {
			t.Fatalf("blocked %s %s reached downstream as %s", testCase.method, testCase.path, gotPath)
		}
	}
}
