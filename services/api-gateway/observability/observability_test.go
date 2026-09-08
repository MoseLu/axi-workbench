package observability

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestGinContinuesIncomingTraceAndReturnsChildTraceparent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	otel.SetTracerProvider(provider)
	t.Cleanup(func() {
		_ = provider.Shutdown(t.Context())
	})

	router := gin.New()
	router.Use(Gin("axi-api-gateway"))
	router.GET("/health", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	const incoming = "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	request.Header.Set("traceparent", incoming)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	traceparent := response.Header().Get("traceparent")
	if !strings.HasPrefix(traceparent, "00-0123456789abcdef0123456789abcdef-") || traceparent == incoming {
		t.Fatalf("response traceparent = %q, want a child of %q", traceparent, incoming)
	}
	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("ended spans = %d, want 1", len(spans))
	}
	if spans[0].Parent().TraceID().String() != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("parent trace ID = %s", spans[0].Parent().TraceID())
	}
}

func TestSetupExportsToConfiguredOTLPHTTPEndpoint(t *testing.T) {
	requests := make(chan string, 1)
	collector := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests <- request.URL.Path
		writer.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(collector.Close)
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", collector.URL)

	shutdown, err := Setup(t.Context(), "axi-api-gateway", collector.URL)
	if err != nil {
		t.Fatalf("Setup() error = %v", err)
	}
	_, span := otel.Tracer("axi-api-gateway").Start(context.Background(), "health")
	span.End()
	if err := shutdown(t.Context()); err != nil {
		t.Fatalf("shutdown() error = %v", err)
	}

	select {
	case path := <-requests:
		if path != "/v1/traces" {
			t.Fatalf("OTLP request path = %q, want /v1/traces", path)
		}
	default:
		t.Fatal("expected an OTLP export request")
	}
}
