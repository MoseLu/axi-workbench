// Package observability wires service-level OpenTelemetry tracing without
// making a local development server depend on a collector.
package observability

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

// Setup configures OTLP/HTTP export when an endpoint is injected. Without an
// endpoint it intentionally remains a no-op, which keeps local development
// offline while preserving trace context propagation.
func Setup(ctx context.Context, serviceName, endpoint string) (func(context.Context) error, error) {
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	if strings.TrimSpace(endpoint) == "" {
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, err
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes("", attribute.String("service.name", serviceName))),
	)
	otel.SetTracerProvider(provider)
	return provider.Shutdown, nil
}

// Gin creates a server span from the incoming W3C trace context and returns a
// child traceparent header so downstream systems and browser diagnostics share
// the same request chain.
func Gin(serviceName string) gin.HandlerFunc {
	tracer := otel.Tracer(serviceName)
	return func(c *gin.Context) {
		requestContext := propagation.TraceContext{}.Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		requestContext, span := tracer.Start(requestContext, c.Request.Method+" "+route, trace.WithSpanKind(trace.SpanKindServer))
		c.Request = c.Request.WithContext(requestContext)
		c.Next()

		span.SetAttributes(
			attribute.String("http.request.method", c.Request.Method),
			attribute.String("url.path", c.Request.URL.Path),
			attribute.Int("http.response.status_code", c.Writer.Status()),
		)
		propagation.TraceContext{}.Inject(requestContext, propagation.HeaderCarrier(c.Writer.Header()))
		span.End()
	}
}
