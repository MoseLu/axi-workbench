package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/handlers"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/ratelimit"
)

func TestGatewayReplacesSpoofedInternalHeadersWithVerifiedIdentity(t *testing.T) {
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("X-Axi-Subject"); got != "zitadel-alice" {
			t.Errorf("downstream subject = %q", got)
		}
		if got := request.Header.Get("X-Axi-Internal-Token"); got != "platform-test-token" {
			t.Errorf("downstream internal token = %q", got)
		}
		if got := request.Header.Get("X-Axi-Tenant-ID"); got != "" {
			t.Errorf("spoofed tenant header was forwarded: %q", got)
		}
		if got := request.Header.Get("Authorization"); got != "" {
			t.Errorf("browser bearer was forwarded downstream: %q", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"ok":true}`)
	}))
	defer downstream.Close()

	cfg := testGatewayConfig(downstream.URL, 10)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))

	server := httptest.NewServer(router)
	defer server.Close()
	request, err := http.NewRequest(http.MethodGet, server.URL+"/api/v1/tenants", nil)
	if err != nil {
		t.Fatalf("create gateway request: %v", err)
	}
	request.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
	request.Header.Set("X-Axi-Subject", "attacker")
	request.Header.Set("X-Axi-Tenant-ID", "forged-tenant")
	request.Header.Set("X-Axi-Internal-Token", "attacker-token")
	request.Header.Set("Authorization", "Bearer attacker-token")
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("call gateway: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("gateway proxy status = %d", response.StatusCode)
	}
}

func TestGatewayRateLimitAppliesBeforePublicRoutes(t *testing.T) {
	cfg := testGatewayConfig("http://127.0.0.1:1", 1)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler("http://127.0.0.1:1", "http://127.0.0.1:1", "", "http://127.0.0.1:1", "http://127.0.0.1:1", "http://127.0.0.1:1", "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(1, nil), setupLogger("disabled"))

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/health", nil))
	if first.Code != http.StatusOK {
		t.Fatalf("first health request = %d", first.Code)
	}
	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/health", nil))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second health request = %d, want %d", second.Code, http.StatusTooManyRequests)
	}
}

func TestGatewayRoutesZitadelQRCompletionThroughIdentityAdapter(t *testing.T) {
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/internal/zitadel/qr/transactions/transaction-1/complete" {
			t.Errorf("identity callback path = %q", request.URL.Path)
		}
		if got := request.Header.Get("X-Axi-Zitadel-Webhook"); got != "webhook-secret" {
			t.Errorf("webhook secret header = %q", got)
		}
		if got := request.Header.Get("X-Axi-Internal-Token"); got != "identity-test-token" {
			t.Errorf("identity internal token = %q", got)
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer downstream.Close()

	cfg := testGatewayConfig(downstream.URL, 10)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))

	gateway := httptest.NewServer(router)
	defer gateway.Close()
	request, err := http.NewRequest(http.MethodPost, gateway.URL+"/api/v1/internal/zitadel/qr/transactions/transaction-1/complete", nil)
	if err != nil {
		t.Fatalf("create gateway callback request: %v", err)
	}
	request.Header.Set("X-Axi-Zitadel-Webhook", "webhook-secret")
	response, err := gateway.Client().Do(request)
	if err != nil {
		t.Fatalf("call gateway callback: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("gateway callback status = %d, want %d", response.StatusCode, http.StatusNoContent)
	}
}

func TestGatewayFansOutPlatformEventsWithConsumerCredentials(t *testing.T) {
	assertConsumer := func(name, token string, got *bool) *httptest.Server {
		return httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			if request.URL.Path != "/internal/events" {
				t.Errorf("%s path = %q", name, request.URL.Path)
			}
			if gotToken := request.Header.Get("X-Axi-Internal-Token"); gotToken != token {
				t.Errorf("%s token = %q, want %q", name, gotToken, token)
			}
			if gotID := request.Header.Get("X-Axi-Event-ID"); gotID != "event-1" {
				t.Errorf("%s event id = %q", name, gotID)
			}
			*got = true
			writer.WriteHeader(http.StatusNoContent)
		}))
	}

	var notificationCalled, workflowCalled bool
	notification := assertConsumer("notification", "notification-test-token", &notificationCalled)
	defer notification.Close()
	workflow := assertConsumer("workflow", "workflow-test-token", &workflowCalled)
	defer workflow.Close()

	cfg := testGatewayConfig("http://127.0.0.1:1", 10)
	cfg.Services.NotificationURL = notification.URL
	cfg.Services.WorkflowURL = workflow.URL
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler("http://127.0.0.1:1", "http://127.0.0.1:1", "", "http://127.0.0.1:1", workflow.URL, notification.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))

	request := httptest.NewRequest(http.MethodPost, "/api/v1/internal/events", strings.NewReader(`{"id":"event-1","tenantId":"tenant-1","topic":"task.created","payload":{"createdBy":"alice"}}`))
	request.Header.Set("X-Axi-Internal-Token", "outbox-test-token")
	request.Header.Set("X-Axi-Event-ID", "event-1")
	request.Header.Set("X-Axi-Event-Topic", "task.created")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("event fan-out status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if !notificationCalled || !workflowCalled {
		t.Fatalf("event consumers called notification=%v workflow=%v", notificationCalled, workflowCalled)
	}
}

func TestGatewayRejectsUnauthenticatedPlatformEvent(t *testing.T) {
	cfg := testGatewayConfig("http://127.0.0.1:1", 10)
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler("http://127.0.0.1:1", "http://127.0.0.1:1", "", "http://127.0.0.1:1", "http://127.0.0.1:1", "http://127.0.0.1:1", "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))

	request := httptest.NewRequest(http.MethodPost, "/api/v1/internal/events", strings.NewReader(`{}`))
	request.Header.Set("X-Axi-Internal-Token", "attacker-token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated event status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestGatewayRewritesSpecialistPathsAndUsesDedicatedTokens(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		gatewayPath    string
		downstreamPath string
		internalToken  string
	}{
		{name: "file", method: http.MethodGet, gatewayPath: "/api/v1/files/download/report.pdf", downstreamPath: "/files/download/report.pdf", internalToken: "file-test-token"},
		{name: "workflow", method: http.MethodPost, gatewayPath: "/api/v1/workflows/workflow-1/execute", downstreamPath: "/workflows/workflow-1/execute", internalToken: "workflow-test-token"},
		{name: "notification", method: http.MethodGet, gatewayPath: "/api/v1/notifications/nav-badges", downstreamPath: "/api/v1/notifications/nav-badges", internalToken: "notification-test-token"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				if request.URL.Path != tt.downstreamPath {
					t.Errorf("downstream path = %q, want %q", request.URL.Path, tt.downstreamPath)
				}
				if got := request.Header.Get("X-Axi-Internal-Token"); got != tt.internalToken {
					t.Errorf("downstream internal token = %q, want %q", got, tt.internalToken)
				}
				if got := request.Header.Get("X-Axi-Subject"); got != "zitadel-alice" {
					t.Errorf("downstream subject = %q", got)
				}
				writer.WriteHeader(http.StatusNoContent)
			}))
			defer downstream.Close()

			cfg := testGatewayConfig(downstream.URL, 10)
			identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
			proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
			router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))

			gateway := httptest.NewServer(router)
			defer gateway.Close()
			request, err := http.NewRequest(tt.method, gateway.URL+tt.gatewayPath, nil)
			if err != nil {
				t.Fatalf("create gateway request: %v", err)
			}
			request.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
			response, err := gateway.Client().Do(request)
			if err != nil {
				t.Fatalf("call gateway: %v", err)
			}
			response.Body.Close()
			if response.StatusCode != http.StatusNoContent {
				t.Fatalf("gateway status = %d, want %d", response.StatusCode, http.StatusNoContent)
			}
		})
	}
}

func TestGatewayRoutesMobileAndWebHandoffThroughControlPlaneBoundary(t *testing.T) {
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/internal/mobile/v1/workspace":
			if got := request.Header.Get("Authorization"); got != "Bearer device-short-lived-token" {
				t.Errorf("mobile device bearer = %q", got)
			}
			if got := request.Header.Get("X-Axi-Internal-Token"); got != "control-plane-test-token" {
				t.Errorf("mobile internal token = %q", got)
			}
			if got := request.Header.Get("X-Axi-Subject"); got != "" {
				t.Errorf("untrusted mobile subject was forwarded: %q", got)
			}
		case "/internal/web/v1/handoffs/handoff-1":
			if got := request.Header.Get("X-Axi-Subject"); got != "zitadel-alice" {
				t.Errorf("web handoff subject = %q", got)
			}
			if got := request.Header.Get("Authorization"); got != "" {
				t.Errorf("browser bearer leaked to handoff backend: %q", got)
			}
		default:
			t.Errorf("unexpected control-plane path = %q", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{}`)
	}))
	defer downstream.Close()

	cfg := testGatewayConfig(downstream.URL, 10)
	cfg.Services.ControlPlaneURL = downstream.URL
	cfg.Services.ControlPlaneInternalToken = "control-plane-test-token"
	identityService := identity.NewForTest(cfg.Identity, identity.NewMemoryRecordStore(nil), nil, nil)
	proxy := handlers.NewProxyHandler(downstream.URL, downstream.URL, "", downstream.URL, downstream.URL, downstream.URL, "identity-test-token", "platform-test-token", "file-test-token", "workflow-test-token", "notification-test-token")
	router := setupRouter(cfg, proxy, identityService, ratelimit.NewMemory(10, nil), setupLogger("disabled"))
	gateway := httptest.NewServer(router)
	defer gateway.Close()

	mobile, err := http.NewRequest(http.MethodGet, gateway.URL+"/api/v1/mobile/workspace", nil)
	if err != nil {
		t.Fatalf("create mobile request: %v", err)
	}
	mobile.Header.Set("Authorization", "Bearer device-short-lived-token")
	mobile.Header.Set("X-Axi-Subject", "attacker")
	mobileResponse, err := gateway.Client().Do(mobile)
	if err != nil {
		t.Fatalf("call mobile proxy: %v", err)
	}
	mobileResponse.Body.Close()
	if mobileResponse.StatusCode != http.StatusOK {
		t.Fatalf("mobile proxy status = %d", mobileResponse.StatusCode)
	}

	handoff, err := http.NewRequest(http.MethodGet, gateway.URL+"/api/v1/handoffs/handoff-1", nil)
	if err != nil {
		t.Fatalf("create handoff request: %v", err)
	}
	handoff.Header.Set("X-Axi-Development-Subject", "zitadel-alice")
	handoff.Header.Set("Authorization", "Bearer attacker-token")
	handoffResponse, err := gateway.Client().Do(handoff)
	if err != nil {
		t.Fatalf("call handoff proxy: %v", err)
	}
	handoffResponse.Body.Close()
	if handoffResponse.StatusCode != http.StatusOK {
		t.Fatalf("handoff proxy status = %d", handoffResponse.StatusCode)
	}
}

func testGatewayConfig(platformURL string, rateLimit int) *config.Config {
	return &config.Config{
		Environment: "development",
		Identity: config.IdentityConfig{
			SessionCookieName:     "axi_session",
			SessionTTL:            time.Hour,
			DevelopmentHeaderAuth: true,
		},
		RateLimit: config.RateLimitConfig{RequestsPerMinute: rateLimit},
		Services: config.ServicesConfig{
			PlatformCoreURL:           platformURL,
			FileServiceURL:            platformURL,
			WorkflowURL:               platformURL,
			NotificationURL:           platformURL,
			FileInternalToken:         "file-test-token",
			WorkflowInternalToken:     "workflow-test-token",
			NotificationInternalToken: "notification-test-token",
			PlatformOutboxToken:       "outbox-test-token",
			ControlPlaneURL:           platformURL,
			ControlPlaneInternalToken: "control-plane-test-token",
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"http://127.0.0.1:5173"},
			AllowedMethods: []string{"GET"},
			AllowedHeaders: []string{"Content-Type"},
		},
	}
}
