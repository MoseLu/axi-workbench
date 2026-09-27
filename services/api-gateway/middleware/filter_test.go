package middleware

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/epap/api-gateway/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestFilterChain(t *testing.T) {
	t.Run("FilterChain executes in order", func(t *testing.T) {
		executionOrder := make([]int, 0)

		filter1 := &orderTrackingFilter{order: &executionOrder, expectedIndex: 0}
		filter2 := &orderTrackingFilter{order: &executionOrder, expectedIndex: 1}
		filter3 := &orderTrackingFilter{order: &executionOrder, expectedIndex: 2}

		chain := FilterChain{filter1, filter2, filter3}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		chain.Next(c)

		assert.Equal(t, []int{0, 1, 2}, executionOrder)
	})

	t.Run("FilterChain handles empty chain", func(t *testing.T) {
		chain := FilterChain{}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		// Should not panic
		chain.Next(c)
	})

	t.Run("Filter can short-circuit", func(t *testing.T) {
		executionOrder := make([]int, 0)

		filter1 := &shortCircuitFilter{order: &executionOrder, index: 0}
		filter2 := &orderTrackingFilter{order: &executionOrder, expectedIndex: -1}

		chain := FilterChain{filter1, filter2}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		chain.Next(c)

		// Only filter1 should have executed
		assert.Equal(t, []int{0}, executionOrder)
	})
}

// Test helper filters
type orderTrackingFilter struct {
	order         *[]int
	expectedIndex int
}

func (f *orderTrackingFilter) Name() string { return "order-tracking" }
func (f *orderTrackingFilter) Filter(c *gin.Context, chain FilterChain) {
	*f.order = append(*f.order, f.expectedIndex)
	chain.Next(c)
}

type shortCircuitFilter struct {
	order *[]int
	index int
}

func (f *shortCircuitFilter) Name() string { return "short-circuit" }
func (f *shortCircuitFilter) Filter(c *gin.Context, chain FilterChain) {
	*f.order = append(*f.order, f.index)
	// Don't call chain.Next() - short circuit
}

func TestAdaptHandler(t *testing.T) {
	t.Run("adaptHandler wraps gin.HandlerFunc", func(t *testing.T) {
		called := false
		handler := func(c *gin.Context) {
			called = true
		}

		filter := AdaptHandler("test-filter", handler)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		// Create a chain where this filter is the terminal one
		emptyChain := FilterChain{}
		filter.Filter(c, emptyChain)

		assert.True(t, called)
		assert.Equal(t, "test-filter", filter.Name())
	})

	t.Run("adaptHandler calls next in chain", func(t *testing.T) {
		executionOrder := make([]int, 0)

		handler := func(c *gin.Context) {
			executionOrder = append(executionOrder, 1)
		}

		filter := AdaptHandler("adapted", handler)
		nextFilter := &orderTrackingFilter{order: &executionOrder, expectedIndex: 2}

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{nextFilter})

		assert.Equal(t, []int{1, 2}, executionOrder)
	})
}

func TestAdaptHandlers(t *testing.T) {
	t.Run("adaptHandlers converts multiple handlers", func(t *testing.T) {
		order := make([]int, 0)

		handler1 := func(c *gin.Context) {
			order = append(order, 1)
		}
		handler2 := func(c *gin.Context) {
			order = append(order, 2)
		}

		chain := AdaptHandlers("test", handler1, handler2)
		lastFilter := &orderTrackingFilter{order: &order, expectedIndex: 3}

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		// Append last filter to chain
		fullChain := append(chain, lastFilter)
		fullChain.Next(c)

		assert.Equal(t, []int{1, 2, 3}, order)
		assert.Len(t, chain, 2)
	})
}

func TestRateLimitFilter(t *testing.T) {
	t.Run("RateLimitFilter allows request when under limit", func(t *testing.T) {
		limiter := &mockLimiter{allowed: true, remaining: 99}
		filter := NewRateLimitFilter(limiter)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "99", w.Header().Get("X-RateLimit-Remaining"))
	})

	t.Run("RateLimitFilter rejects when over limit", func(t *testing.T) {
		limiter := &mockLimiter{allowed: false, remaining: 0, resetAt: time.Now().Add(time.Minute)}
		filter := NewRateLimitFilter(limiter)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusTooManyRequests, w.Code)
		assert.NotEmpty(t, w.Header().Get("Retry-After"))
	})

	t.Run("RateLimitFilter returns 503 on error", func(t *testing.T) {
		limiter := &mockLimiter{err: errTest}
		filter := NewRateLimitFilter(limiter)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	})
}

var errTest = assert.AnError

type mockLimiter struct {
	allowed   bool
	remaining int
	resetAt   time.Time
	err       error
}

func (m *mockLimiter) Allow(_ context.Context, _ string) (ratelimit.Decision, error) {
	if m.err != nil {
		return ratelimit.Decision{}, m.err
	}
	return ratelimit.Decision{
		Allowed:   m.allowed,
		Remaining: m.remaining,
		ResetAt:   m.resetAt,
	}, nil
}

func (m *mockLimiter) Ping(_ context.Context) error { return nil }
func (m *mockLimiter) Close() error              { return nil }

func TestAuditFilter(t *testing.T) {
	t.Run("AuditFilter executes after chain", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/test", nil)
		c.Set("request_id", "req-123")
		c.Request.Header.Set("traceparent", "00-abc-def-01")

		filter := NewAuditFilter(zerolog.New(io.Discard))
		// The filter should not panic
		filter.Filter(c, FilterChain{})
	})
}

func TestCORSFilter(t *testing.T) {
	t.Run("CORSFilter adds headers", func(t *testing.T) {
		filter := NewCORSFilter(
			[]string{"https://example.com"},
			[]string{"GET", "POST"},
			[]string{"Authorization", "Content-Type"},
		)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Origin", "https://example.com")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "https://example.com", w.Header().Get("Access-Control-Allow-Origin"))
		assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "GET")
		assert.Contains(t, w.Header().Get("Access-Control-Allow-Headers"), "Authorization")
	})

	t.Run("CORSFilter rejects disallowed origin", func(t *testing.T) {
		filter := NewCORSFilter(
			[]string{"https://allowed.com"},
			[]string{"GET"},
			[]string{"*"},
		)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Origin", "https://evil.com")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("CORSFilter handles preflight", func(t *testing.T) {
		filter := NewCORSFilter([]string{"*"}, []string{"GET"}, []string{"*"})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("OPTIONS", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusNoContent, w.Code)
	})
}

func TestTraceFilter(t *testing.T) {
	t.Run("TraceFilter preserves existing traceparent", func(t *testing.T) {
		filter := NewTraceFilter()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("traceparent", "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01", w.Header().Get("traceparent"))
	})

	t.Run("TraceFilter generates traceparent when missing", func(t *testing.T) {
		filter := NewTraceFilter()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		traceparent := w.Header().Get("traceparent")
		assert.NotEmpty(t, traceparent)
		assert.True(t, len(traceparent) > 50)
	})
}

func TestRequestIDFilter(t *testing.T) {
	t.Run("RequestIDFilter uses existing header", func(t *testing.T) {
		filter := NewRequestIDFilter()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("X-Request-ID", "existing-id")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "existing-id", w.Header().Get("X-Request-ID"))
	})

	t.Run("RequestIDFilter generates ID when missing", func(t *testing.T) {
		filter := NewRequestIDFilter()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
	})
}

func TestInternalTokenFilter(t *testing.T) {
	t.Run("InternalTokenFilter validates token", func(t *testing.T) {
		filter := NewInternalTokenFilter("secret-token")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/internal/test", nil)
		c.Request.Header.Set("X-Axi-Internal-Token", "secret-token")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("InternalTokenFilter rejects invalid token", func(t *testing.T) {
		filter := NewInternalTokenFilter("secret-token")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/internal/test", nil)
		c.Request.Header.Set("X-Axi-Internal-Token", "wrong-token")

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("InternalTokenFilter rejects missing token", func(t *testing.T) {
		filter := NewInternalTokenFilter("secret-token")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/internal/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestStripPrefixFilter(t *testing.T) {
	t.Run("StripPrefixFilter removes prefix", func(t *testing.T) {
		filter := NewStripPrefixFilter("/api/v1")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/users", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "/users", c.Request.URL.Path)
	})

	t.Run("StripPrefixFilter handles missing prefix", func(t *testing.T) {
		filter := NewStripPrefixFilter("/api/v1")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/other/users", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "/other/users", c.Request.URL.Path)
	})
}

func TestStripPathSegments(t *testing.T) {
	t.Run("strips first 1 segment", func(t *testing.T) {
		handler := StripPathSegments(1)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/users", nil)

		handler(c)

		assert.Equal(t, "/v1/users", c.Request.URL.Path)
	})

	t.Run("strips first 2 segments", func(t *testing.T) {
		handler := StripPathSegments(2)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/users", nil)

		handler(c)

		assert.Equal(t, "/users", c.Request.URL.Path)
	})

	t.Run("strips first 3 segments", func(t *testing.T) {
		handler := StripPathSegments(3)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1/users/profile", nil)

		handler(c)

		assert.Equal(t, "/profile", c.Request.URL.Path)
	})

	t.Run("handles path with fewer segments than N", func(t *testing.T) {
		handler := StripPathSegments(5)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/v1", nil)

		handler(c)

		// When path has fewer segments than N, keep the path unchanged
		assert.Equal(t, "/api/v1", c.Request.URL.Path)
	})

	t.Run("handles root path", func(t *testing.T) {
		handler := StripPathSegments(1)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/", nil)

		handler(c)

		assert.Equal(t, "/", c.Request.URL.Path)
	})
}

func TestRewritePathFilter(t *testing.T) {
	t.Run("RewritePathFilter rewrites path", func(t *testing.T) {
		filter := NewRewritePathFilter("/legacy/", "/modern/")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/legacy/users/123", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "/modern/users/123", c.Request.URL.Path)
	})
}

func TestAddHeaderFilter(t *testing.T) {
	t.Run("AddHeaderFilter adds header", func(t *testing.T) {
		filter := NewAddHeaderFilter("X-Custom-Header", "custom-value")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, "custom-value", c.Request.Header.Get("X-Custom-Header"))
	})
}

func TestRemoveHeaderFilter(t *testing.T) {
	t.Run("RemoveHeaderFilter removes header", func(t *testing.T) {
		filter := NewRemoveHeaderFilter("X-Remove-Me")

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("X-Remove-Me", "to-be-removed")

		filter.Filter(c, FilterChain{})

		assert.Empty(t, c.Request.Header.Get("X-Remove-Me"))
	})
}

func TestRedirectFilter(t *testing.T) {
	t.Run("RedirectFilter permanent redirect", func(t *testing.T) {
		filter := NewRedirectFilter("https://new.example.com", true)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/old", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusMovedPermanently, w.Code)
		assert.Equal(t, "https://new.example.com", w.Header().Get("Location"))
	})

	t.Run("RedirectFilter temporary redirect", func(t *testing.T) {
		filter := NewRedirectFilter("https://new.example.com", false)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/old", nil)

		filter.Filter(c, FilterChain{})

		assert.Equal(t, http.StatusFound, w.Code)
	})
}

func TestRouteGroup(t *testing.T) {
	t.Run("RouteGroup matches first route", func(t *testing.T) {
		group := NewRouteGroup()
		group.Add(Route{
			Name:      "health",
			Predicate: PathPredicate{Patterns: []string{"/health"}},
			Filters:   FilterChain{AdaptHandler("health-handler", func(c *gin.Context) { c.Status(http.StatusOK) })},
		})
		group.Add(Route{
			Name:      "api",
			Predicate: PathPredicate{Patterns: []string{"/api/*"}},
			Filters:   FilterChain{AdaptHandler("api-handler", func(c *gin.Context) { c.Status(http.StatusOK) })},
		})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/health", nil)

		assert.True(t, group.Apply(c))
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("RouteGroup returns false for no match", func(t *testing.T) {
		group := NewRouteGroup()
		group.Add(Route{
			Name:      "health",
			Predicate: PathPredicate{Patterns: []string{"/health"}},
			Filters:   FilterChain{AdaptHandler("health-handler", func(c *gin.Context) { c.Status(http.StatusOK) })},
		})

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/unknown", nil)

		assert.False(t, group.Apply(c))
	})
}

func TestBuilder(t *testing.T) {
	t.Run("Builder creates RouteGroup", func(t *testing.T) {
		builder := NewBuilder()
		builder.Route("health",
			PathPredicate{Patterns: []string{"/health"}},
			AdaptHandler("handler", func(c *gin.Context) { c.Status(http.StatusOK) }),
		)

		group := builder.Build()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/health", nil)

		assert.True(t, group.Apply(c))
	})
}

func TestFilterChainShortCircuit(t *testing.T) {
	t.Run("filter can short-circuit by not calling chain.Next", func(t *testing.T) {
		executionCount := 0

		blockingFilter := &blockingFilter{execCount: &executionCount, index: 1}

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		chain := FilterChain{
			AdaptHandler("first", func(c *gin.Context) { executionCount++ }),
			blockingFilter,
			AdaptHandler("third", func(c *gin.Context) { executionCount++ }),
		}

		chain.Next(c)

		// first filter executes, then blockingFilter short-circuits
		// third filter is never reached
		// Note: AdaptHandler always calls chain.Next(), but blockingFilter does not
		assert.Equal(t, 2, executionCount)
	})

	t.Run("empty chain does not panic", func(t *testing.T) {
		chain := FilterChain{}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)

		// Should not panic
		chain.Next(c)
	})
}

type blockingFilter struct {
	execCount *int
	index     int
}

func (f *blockingFilter) Name() string { return "blocking" }
func (f *blockingFilter) Filter(c *gin.Context, chain FilterChain) {
	*f.execCount++
	// Don't call chain.Next() - this is the short-circuit
}
