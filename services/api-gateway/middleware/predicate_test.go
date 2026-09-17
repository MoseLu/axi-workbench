package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestMethodPredicate(t *testing.T) {
	predicate := MethodPredicate{Methods: []string{"GET", "POST"}}

	tests := []struct {
		name     string
		method   string
		expected bool
	}{
		{"GET matches", "GET", true},
		{"POST matches", "POST", true},
		{"PUT does not match", "PUT", false},
		{"DELETE does not match", "DELETE", false},
		{"case insensitive GET", "get", true},
		{"case insensitive POST", "post", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, "/test", nil)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestPathPredicate(t *testing.T) {
	predicate := PathPredicate{Patterns: []string{"/api/v1/users", "/api/v1/*"}}

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{"exact match", "/api/v1/users", true},
		{"prefix match", "/api/v1/orders", true},
		{"non-matching path", "/api/v2/users", false},
		{"root path", "/", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", tt.path, nil)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestPathPredicateRegex(t *testing.T) {
	predicate := PathPredicate{Patterns: []string{"regex:^/api/v[0-9]+/.*"}}

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{"version v1 matches", "/api/v1/users", true},
		{"version v2 matches", "/api/v2/orders", true},
		{"version v10 matches", "/api/v10/data", true},
		{"no version does not match", "/api/users", false},
		{"static path does not match", "/static/file.js", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", tt.path, nil)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestHeaderPredicate(t *testing.T) {
	predicate := HeaderPredicate{Key: "X-API-Key", Value: "secret123"}

	tests := []struct {
		name       string
		headerKey  string
		headerVal  string
		expected   bool
	}{
		{"exact match", "X-API-Key", "secret123", true},
		{"wrong value", "X-API-Key", "wrong", false},
		{"missing header", "X-API-Key", "", false},
		{"different header", "Authorization", "secret123", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.headerKey != "" {
				req.Header.Set(tt.headerKey, tt.headerVal)
			}
			c.Request = req
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestHeaderPredicatePresence(t *testing.T) {
	predicate := HeaderPredicate{Key: "X-Request-ID"}

	tests := []struct {
		name     string
		hasValue bool
		expected bool
	}{
		{"header present", true, true},
		{"header absent", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.hasValue {
				req.Header.Set("X-Request-ID", "some-id")
			}
			c.Request = req
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestQueryPredicate(t *testing.T) {
	predicate := QueryPredicate{Key: "page", Value: "1"}

	tests := []struct {
		name     string
		query    string
		expected bool
	}{
		{"exact match", "page=1", true},
		{"wrong value", "page=2", false},
		{"missing param", "", false},
		{"with other params", "size=10&page=1", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test?"+tt.query, nil)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestHostPredicate(t *testing.T) {
	predicate := HostPredicate{Hosts: []string{"api.example.com", "*.internal.com"}}

	tests := []struct {
		name     string
		host     string
		expected bool
	}{
		{"exact match", "api.example.com", true},
		{"wildcard subdomain", "app.internal.com", true},
		{"deep subdomain", "deep.app.internal.com", true},
		{"non-matching", "other.com", false},
		{"similar but not match", "notexample.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("GET", "http://"+tt.host+"/test", nil)
			c.Request = req
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestIPRangePredicate(t *testing.T) {
	predicate := IPRangePredicate{CIDRs: []string{"192.168.1.0/24", "10.0.0.1"}}

	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{"exact IP match", "10.0.0.1", true},
		{"within CIDR range", "192.168.1.100", true},
		{"CIDR boundary", "192.168.1.0", true},
		{"outside CIDR range", "192.168.2.1", false},
		{"different subnet", "172.16.0.1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("GET", "/test", nil)
			req.RemoteAddr = tt.ip + ":12345"
			c.Request = req
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestPredicateGroupAnd(t *testing.T) {
	methodPredicate := MethodPredicate{Methods: []string{"POST"}}
	pathPredicate := PathPredicate{Patterns: []string{"/api/*"}}

	group := PredicateGroup{
		Predicates: []Predicate{methodPredicate, pathPredicate},
		And:        true,
	}

	tests := []struct {
		name     string
		method   string
		path     string
		expected bool
	}{
		{"both match", "POST", "/api/users", true},
		{"method mismatch", "GET", "/api/users", false},
		{"path mismatch", "POST", "/other", false},
		{"both mismatch", "DELETE", "/other", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)
			assert.Equal(t, tt.expected, group.Match(c))
		})
	}
}

func TestPredicateGroupOr(t *testing.T) {
	methodPredicate := MethodPredicate{Methods: []string{"OPTIONS"}}
	pathPredicate := PathPredicate{Patterns: []string{"/health"}}

	group := PredicateGroup{
		Predicates: []Predicate{methodPredicate, pathPredicate},
		And:        false,
	}

	tests := []struct {
		name     string
		method   string
		path     string
		expected bool
	}{
		{"first matches", "OPTIONS", "/api", true},
		{"second matches", "GET", "/health", true},
		{"both match", "OPTIONS", "/health", true},
		{"neither matches", "GET", "/api", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)
			assert.Equal(t, tt.expected, group.Match(c))
		})
	}
}

func TestAndOrHelpers(t *testing.T) {
	p1 := MethodPredicate{Methods: []string{"GET"}}
	p2 := PathPredicate{Patterns: []string{"/api/*"}}
	p3 := HeaderPredicate{Key: "Authorization"}

	t.Run("And helper", func(t *testing.T) {
		combined := And(p1, p2)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/api/test", nil)
		assert.True(t, combined.Match(c))

		c.Request = httptest.NewRequest("POST", "/api/test", nil)
		assert.False(t, combined.Match(c))
	})

	t.Run("Or helper", func(t *testing.T) {
		combined := Or(p1, p3)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		c.Request = httptest.NewRequest("GET", "/test", nil)
		assert.True(t, combined.Match(c))

		c.Request = httptest.NewRequest("POST", "/test", nil)
		c.Request.Header.Set("Authorization", "Bearer token")
		assert.True(t, combined.Match(c))

		c.Request = httptest.NewRequest("POST", "/test", nil)
		assert.False(t, combined.Match(c))
	})

	t.Run("Not helper", func(t *testing.T) {
		negated := Not(p1)
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)

		c.Request = httptest.NewRequest("GET", "/test", nil)
		assert.False(t, negated.Match(c))

		c.Request = httptest.NewRequest("POST", "/test", nil)
		assert.True(t, negated.Match(c))
	})
}

func TestStatusCodePredicate(t *testing.T) {
	predicate := StatusCodePredicate{Code: 404}

	tests := []struct {
		name           string
		status         int
		expectedResult bool
	}{
		{"404 matches", 404, true},
		{"200 does not match", 200, false},
		{"500 does not match", 500, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)
			c.Writer.WriteHeader(tt.status)
			assert.Equal(t, tt.expectedResult, predicate.Match(c))
		})
	}
}

func TestStatusCodeRangePredicate(t *testing.T) {
	predicate := StatusCodeRangePredicate{Ranges: []string{"2xx", "4xx"}}

	tests := []struct {
		name     string
		status   int
		expected bool
	}{
		{"200 matches 2xx", 200, true},
		{"201 matches 2xx", 201, true},
		{"404 matches 4xx", 404, true},
		{"499 matches 4xx", 499, true},
		{"500 does not match", 500, false},
		{"300 does not match", 300, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)
			c.Writer.WriteHeader(tt.status)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestStatusCodeRangePredicateWithMinMax(t *testing.T) {
	predicate := StatusCodeRangePredicate{Ranges: []string{"200-299", "500-599"}}

	tests := []struct {
		name     string
		status   int
		expected bool
	}{
		{"200 in range", 200, true},
		{"250 in range", 250, true},
		{"400 not in range", 400, false},
		{"500 in range", 500, true},
		{"550 in range", 550, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)
			c.Writer.WriteHeader(tt.status)
			assert.Equal(t, tt.expected, predicate.Match(c))
		})
	}
}

func TestAlwaysNeverPredicates(t *testing.T) {
	t.Run("AlwaysPredicate", func(t *testing.T) {
		predicate := AlwaysPredicate{}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		assert.True(t, predicate.Match(c))
	})

	t.Run("NeverPredicate", func(t *testing.T) {
		predicate := NeverPredicate{}
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		assert.False(t, predicate.Match(c))
	})
}

func TestContentTypePredicate(t *testing.T) {
	predicate := ContentTypePredicate{Types: []string{"application/json", "application/xml"}}

	tests := []struct {
		name          string
		contentType   string
		expectedMatch bool
	}{
		{"exact JSON match", "application/json", true},
		{"JSON with charset", "application/json; charset=utf-8", true},
		{"XML match", "application/xml", true},
		{"text/plain does not match", "text/plain", false},
		{"empty content type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("POST", "/test", nil)
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}
			c.Request = req
			assert.Equal(t, tt.expectedMatch, predicate.Match(c))
		})
	}
}

func TestAcceptPredicate(t *testing.T) {
	predicate := AcceptPredicate{Types: []string{"application/json", "text/html"}}

	tests := []struct {
		name          string
		accept        string
		expectedMatch bool
	}{
		{"JSON accepted", "application/json", true},
		{"HTML accepted", "text/html", true},
		{"wildcard accepts anything", "*/*", true},
		{"empty accepts anything", "", true},
		{"XML not accepted", "application/xml", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.accept != "" {
				req.Header.Set("Accept", tt.accept)
			}
			c.Request = req
			assert.Equal(t, tt.expectedMatch, predicate.Match(c))
		})
	}
}

func TestPredicateFunc(t *testing.T) {
	customPredicate := PredicateFunc(func(c *gin.Context) bool {
		return c.Request.URL.Path != "/blocked"
	})

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{"allowed path", "/allowed", true},
		{"blocked path", "/blocked", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", tt.path, nil)
			assert.Equal(t, tt.expected, customPredicate.Match(c))
		})
	}
}

func TestHostPredicateWithPort(t *testing.T) {
	predicate := HostPredicate{Hosts: []string{"api.example.com"}}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest("GET", "/test", nil)
	req.Host = "api.example.com:8080"
	c.Request = req

	// Should match even with port
	assert.True(t, predicate.Match(c))
}

func TestMethodPredicateCaseInsensitive(t *testing.T) {
	predicate := MethodPredicate{Methods: []string{"POST"}}

	methods := []string{"POST", "post", "Post", "pOsT"}
	for _, method := range methods {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(method, "/test", nil)
		assert.True(t, predicate.Match(c), "Method %s should match", method)
	}
}
