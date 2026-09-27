package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

// TestGinExtractsIncomingTraceAndCreatesChildSpan covers the
// behaviour delivered by the thin axilog.OtelGinMiddleware wrapper
// after the PRD-07 phase 2 migration: incoming W3C traceparent is
// extracted and the recorded span inherits its trace_id. The
// legacy implementation additionally wrote a child traceparent
// header to the response; axilog doesn't do that, so this test no
// longer asserts on `response.Header().Get("traceparent")`.
func TestGinExtractsIncomingTraceAndCreatesChildSpan(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	otel.SetTracerProvider(provider)
	// axilog's middleware reads otel.GetTextMapPropagator(); install
	// the same W3C TraceContext + Baggage composite that main.go's
	// Setup path installs, otherwise extraction is a no-op.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	t.Cleanup(func() {
		_ = provider.Shutdown(t.Context())
	})

	router := gin.New()
	router.Use(Gin("axi-api-gateway"))
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	const incomingTraceID = "0123456789abcdef0123456789abcdef"
	const incoming = "00-" + incomingTraceID + "-0123456789abcdef-01"
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("traceparent", incoming)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("ended spans = %d, want 1", len(spans))
	}
	if got := spans[0].Parent().TraceID().String(); got != incomingTraceID {
		t.Fatalf("parent trace ID = %s, want %s", got, incomingTraceID)
	}
}

// TestSetupNoopWithoutEndpoint exercises the empty-endpoint branch
// of the wrapper: when no OTLP endpoint is configured, axilog is
// not invoked and Setup returns a no-op shutdown function. This
// preserves the legacy "local development offline" contract that
// the old OTLP/HTTP transport also offered.
//
// For non-empty endpoints the SDK now uses OTLP/gRPC transport via
// axilog.SetupTracing; that path is exercised end-to-end by the
// SDK's own test suite (foundation/axi-observability/go/axilog)
// and we do not duplicate it here.
func TestSetupNoopWithoutEndpoint(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	t.Setenv("AXI_OTLP_TRACES_ENDPOINT", "")

	shutdown, err := Setup(t.Context(), "axi-api-gateway", "")
	if err != nil {
		t.Fatalf("Setup() with empty endpoint error = %v", err)
	}
	if shutdown == nil {
		t.Fatal("expected a non-nil shutdown func even in no-op mode")
	}
	if err := shutdown(t.Context()); err != nil {
		t.Fatalf("shutdown() error = %v", err)
	}

	// Sanity: even with no provider installed, a tracer span from
	// the API ought not to panic.
	_, span := otel.Tracer("axi-api-gateway").Start(context.Background(), "noop")
	span.End()
}
