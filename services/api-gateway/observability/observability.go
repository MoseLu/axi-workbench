// Package observability wires service-level OpenTelemetry tracing.
//
// As of PRD-07 phase 2 this is a thin wrapper over
// `github.com/axiomaticworld/observability/go/axilog`. The transport
// switched from OTLP/HTTP (legacy) to OTLP/gRPC (SDK default on
// :4317). When `endpoint` is empty the service runs in no-op mode
// just like before — no provider, no exporter.
package observability

import (
	"context"
	"os"
	"strings"

	"github.com/axiomaticworld/observability/go/axilog"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

// Setup configures the global OTel TracerProvider for the given
// service. When `endpoint` is empty the service runs in no-op mode
// (no provider, no exporter); otherwise AXI_OTLP_TRACES_ENDPOINT is
// set so `axilog.SetupTracing` honors the explicit URL.
//
// The W3C TraceContext + Baggage composite propagator is installed
// regardless of whether the OTLP exporter is configured, so
// downstream `axilog.TraceIDFromContext` reads return the upstream
// trace_id even on local development setups without a collector.
func Setup(ctx context.Context, serviceName, endpoint string) (func(context.Context) error, error) {
	if strings.TrimSpace(endpoint) == "" {
		// Even without an exporter, install the W3C TraceContext +
		// Baggage propagator so downstream axilog.TraceIDFromContext
		// reads return the upstream trace_id during local dev.
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		))
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
