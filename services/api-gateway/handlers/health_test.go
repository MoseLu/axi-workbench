package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/epap/api-gateway/config"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newTestConfig returns a Config whose downstream URLs point at in-process
// httptest servers so ReadyCheck can exercise the real HTTP code path.
func newTestConfig(t *testing.T, urls map[string]string) *config.Config {
	t.Helper()
	cfg := &config.Config{}
	cfg.Services.IdentityAdapterURL = urls["identity-adapter"]
	cfg.Services.PlatformCoreURL = urls["platform-core"]
	cfg.Services.WorkflowURL = urls["workflow-engine"]
	cfg.Services.NotificationURL = urls["notification-service"]
	cfg.Services.FileServiceURL = urls["file-service"]
	return cfg
}

// runReadyCheck wires ReadyCheck against a fresh recorder and returns the
// response body and status.
func runReadyCheck(t *testing.T, cfg *config.Config) (int, map[string]interface{}) {
	t.Helper()
	r := gin.New()
	r.GET("/ready", ReadyCheck(cfg))
	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v (raw=%q)", err, w.Body.String())
	}
	return w.Code, body
}

func TestReadyCheck_AllUp(t *testing.T) {
	servers := map[string]string{}
	for _, name := range []string{"identity-adapter", "platform-core", "workflow-engine", "notification-service", "file-service"} {
		name := name
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
		}))
		t.Cleanup(srv.Close)
		servers[name] = srv.URL
	}

	cfg := newTestConfig(t, servers)
	status, body := runReadyCheck(t, cfg)
	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d (body=%v)", status, body)
	}
	if body["status"] != "ready" {
		t.Fatalf("expected status=ready, got %v", body["status"])
	}
	downstream, ok := body["downstream"].([]interface{})
	if !ok {
		t.Fatalf("downstream is not an array: %v", body["downstream"])
	}
	if len(downstream) != 5 {
		t.Fatalf("expected 5 downstream entries, got %d", len(downstream))
	}
	for _, e := range downstream {
		m := e.(map[string]interface{})
		if m["status"] != "up" {
			t.Errorf("expected upstream=up, got %v (entry=%v)", m["status"], m)
		}
	}
}

func TestReadyCheck_OneDown(t *testing.T) {
	servers := map[string]string{}
	for _, name := range []string{"identity-adapter", "platform-core", "workflow-engine", "notification-service", "file-service"} {
		name := name
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if name == "platform-core" {
				http.Error(w, "boom", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(srv.Close)
		servers[name] = srv.URL
	}

	cfg := newTestConfig(t, servers)
	status, body := runReadyCheck(t, cfg)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when platform-core returns 500, got %d (body=%v)", status, body)
	}
	if body["status"] != "not_ready" {
		t.Fatalf("expected status=not_ready, got %v", body["status"])
	}
}

func TestReadyCheck_TransportError(t *testing.T) {
	// Point every downstream at a closed port - probeDownstream should fail
	// and the response should flip to 503.
	cfg := newTestConfig(t, map[string]string{
		"identity-adapter":    "http://127.0.0.1:1",
		"platform-core":       "http://127.0.0.1:1",
		"workflow-engine":     "http://127.0.0.1:1",
		"notification-service": "http://127.0.0.1:1",
		"file-service":        "http://127.0.0.1:1",
	})
	status, _ := runReadyCheck(t, cfg)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when all downstreams unreachable, got %d", status)
	}
}

func TestReadyCheck_NotConfiguredSkips(t *testing.T) {
	// Only configure 2 downstreams; the remaining three should report
	// "not_configured" and must NOT cause a 503.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	cfg := newTestConfig(t, map[string]string{
		"identity-adapter": srv.URL,
		"platform-core":    srv.URL,
		// workflow-engine, notification-service, file-service intentionally empty
	})
	status, body := runReadyCheck(t, cfg)
	if status != http.StatusOK {
		t.Fatalf("expected 200 when only configured services are required, got %d (body=%v)", status, body)
	}
}

func TestHealthCheck_StaysCheap(t *testing.T) {
	// HealthCheck must NOT touch downstreams; even with all URLs pointing at
	// closed ports it should still return 200 OK because it is a liveness
	// probe for the process itself.
	_ = newTestConfig(t, map[string]string{
		"identity-adapter":    "http://127.0.0.1:1",
		"platform-core":       "http://127.0.0.1:1",
		"workflow-engine":     "http://127.0.0.1:1",
		"notification-service": "http://127.0.0.1:1",
		"file-service":        "http://127.0.0.1:1",
	})
	r := gin.New()
	r.GET("/health", HealthCheck())
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected /health 200 even when downstreams unreachable, got %d", w.Code)
	}
}