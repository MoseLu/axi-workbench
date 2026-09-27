// Package observability wires service-level OpenTelemetry tracing.
//
// As of PRD-07 phase 2 this is a thin wrapper over
// `github.com/axiomaticworld/observability/go/axilog`. The legacy
// signature is preserved so existing callers in `main.go` and
// `httpapi/api.go` keep working — the underlying transport switched
// from OTLP/HTTP to OTLP/gRPC, which the foundation's OTel collector
// accepts on :4317 by default.
package observability

import (
	"context"
	"os"
	"strings"

	"github.com/axiomaticworld/observability/go/axilog"
	"github.com/gin-gonic/gin"
)

// Setup configures the global OTel TracerProvider for the given
// service. When `endpoint` is empty the service runs in no-op mode
// (no provider, no exporter); otherwise AXI_OTLP_TRACES_ENDPOINT is
// set so `axilog.SetupTracing` honors the explicit URL.
func Setup(ctx context.Context, serviceName, endpoint string) (func(context.Context) error, error) {
	if strings.TrimSpace(endpoint) == "" {
		return func(context.Context) error { return nil }, nil
	}
	_ = os.Setenv("AXI_OTLP_TRACES_ENDPOINT", endpoint)
	provider, err := axilog.SetupTracing(serviceName)
	if err != nil {
		return nil, err
	}
	return provider.Shutdown, nil
}

// Gin returns the Gin middleware that starts an OTel span per
// request, extracts W3C traceparent, and threads trace_id onto the
// request context so downstream slog records carry it automatically.
// The `serviceName` parameter is kept for backwards compatibility
// with older call sites but the SDK uses OTel tracer naming.
func Gin(serviceName string) gin.HandlerFunc {
	return axilog.OtelGinMiddleware()
}
