package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/epap/api-gateway/config"
)

// downstreamProbe describes a single backend service the gateway depends on.
type downstreamProbe struct {
	Name string
	URL  string
}

// HealthCheck returns the liveness status of the API Gateway process itself.
//
// It intentionally does NOT touch downstream services. Liveness means the
// gateway process is up and able to serve HTTP traffic; it must remain cheap
// and must not flap because a peer service is briefly degraded. Use ReadyCheck
// for downstream reachability.
func HealthCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-gateway",
			"version": "1.0.0",
		})
	}
}

// probeTimeout caps each downstream HTTP ping. Kept short so /ready cannot
// stall the rest of the probe fan-out and so Kubernetes/PM2 health sweeps
// don't pile up if a backend is wedged.
const probeTimeout = 2 * time.Second

// probeDownstream issues a short-lived HTTP GET against the given URL and
// returns nil when the peer responds with any 2xx/3xx. Non-2xx, transport
// errors, and timeout all surface as a non-nil error.
func probeDownstream(ctx context.Context, url string) error {
	client := &http.Client{Timeout: probeTimeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return &probeStatusError{Code: resp.StatusCode}
	}
	return nil
}

type probeStatusError struct{ Code int }

func (e *probeStatusError) Error() string {
	return "downstream returned non-success status"
}

// downstreamProbes returns the canonical set of downstream services the
// gateway should ping. Order is preserved in the JSON response so operators
// can eyeball the report without sorting.
//
// Defaults assume the standard local-5-port development layout. In production
// the values are pulled from environment variables loaded into cfg.Services
// (see config.Load). When a service URL is empty it is reported as
// "not_configured" and does not count as a failure - for example, a
// deployment that legitimately does not run file-service can pass an empty
// FILE_SERVICE_URL and still be considered ready.
func downstreamProbes(cfg *config.Config) []downstreamProbe {
	return []downstreamProbe{
		{Name: "identity-adapter", URL: cfg.Services.IdentityAdapterURL},
		{Name: "platform-core", URL: cfg.Services.PlatformCoreURL},
		{Name: "workflow-engine", URL: cfg.Services.WorkflowURL},
		{Name: "notification-service", URL: cfg.Services.NotificationURL},
		{Name: "file-service", URL: cfg.Services.FileServiceURL},
	}
}

// ReadyCheck returns the readiness status - i.e. are the downstream services
// the gateway depends on actually reachable? Any single failure flips the
// response status to 503 so Kubernetes/PM2 health gates remove the pod from
// rotation until the dependency recovers.
func ReadyCheck(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		probes := downstreamProbes(cfg)

		type result struct {
			Name   string `json:"name"`
			URL    string `json:"url,omitempty"`
			Status string `json:"status"`
			Error  string `json:"error,omitempty"`
		}

		results := make([]result, len(probes))
		var wg sync.WaitGroup
		for i, p := range probes {
			i, p := i, p
			wg.Add(1)
			go func() {
				defer wg.Done()
				if p.URL == "" {
					results[i] = result{Name: p.Name, Status: "not_configured"}
					return
				}
				ctx, cancel := context.WithTimeout(c.Request.Context(), probeTimeout)
				defer cancel()
				if err := probeDownstream(ctx, p.URL); err != nil {
					results[i] = result{Name: p.Name, URL: p.URL, Status: "down", Error: err.Error()}
					return
				}
				results[i] = result{Name: p.Name, URL: p.URL, Status: "up"}
			}()
		}
		wg.Wait()

		overall := "ready"
		status := http.StatusOK
		for _, r := range results {
			if r.Status == "down" {
				overall = "not_ready"
				status = http.StatusServiceUnavailable
				break
			}
		}

		body := gin.H{
			"status":     overall,
			"service":    "api-gateway",
			"version":    "1.0.0",
			"downstream": results,
		}
		// Set content type explicitly so failure consumers (load balancers,
		// k8s probes) get a JSON document regardless of middleware ordering.
		c.Data(status, "application/json; charset=utf-8", mustJSON(body))
	}
}

func mustJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		// Last-resort fallback. Returning a hardcoded JSON document is
		// preferable to a panic on the readiness path; the operator still
		// gets a status code to react to.
		return []byte(`{"status":"not_ready","error":"marshal_failure"}`)
	}
	return b
}