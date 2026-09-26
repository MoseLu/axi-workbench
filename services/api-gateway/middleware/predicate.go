package middleware

import (
	"net"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// Predicate is the matching condition interface for filter routing.
// Inspired by Spring Cloud Gateway's RoutePredicateFactory pattern.
type Predicate interface {
	Match(*gin.Context) bool
}

// PredicateGroup combines multiple predicates with AND/OR logic.
type PredicateGroup struct {
	Predicates []Predicate
	And        bool // true for AND, false for OR
}

func (g PredicateGroup) Match(c *gin.Context) bool {
	if len(g.Predicates) == 0 {
		return true
	}
	for _, p := range g.Predicates {
		result := p.Match(c)
		if g.And {
			if !result {
				return false
			}
		} else {
			if result {
				return true
			}
		}
	}
	// If we get here, no short-circuit occurred
	// For AND: all predicates matched (we'd have returned false above)
	// For OR: no predicates matched (we'd have returned true above)
	return g.And
}

// And combines two predicates using AND logic.
func And(left, right Predicate) Predicate {
	return PredicateGroup{Predicates: []Predicate{left, right}, And: true}
}

// Or combines two predicates using OR logic.
func Or(left, right Predicate) Predicate {
	return PredicateGroup{Predicates: []Predicate{left, right}, And: false}
}

// Not negates a predicate.
func Not(p Predicate) Predicate {
	return notPredicate{inner: p}
}

type notPredicate struct{ inner Predicate }

func (n notPredicate) Match(c *gin.Context) bool {
	return !n.inner.Match(c)
}

// MethodPredicate matches requests by HTTP method.
type MethodPredicate struct {
	Methods []string
}

func (m MethodPredicate) Match(c *gin.Context) bool {
	method := c.Request.Method
	for _, allowed := range m.Methods {
		if strings.EqualFold(method, allowed) {
			return true
		}
	}
	return false
}

// PathPredicate matches requests by URL path patterns.
// Supports exact match, prefix match (* suffix), and regex (regex: prefix).
type PathPredicate struct {
	Patterns []string
}

func (p PathPredicate) Match(c *gin.Context) bool {
	path := c.Request.URL.Path
	for _, pattern := range p.Patterns {
		if matchPath(path, pattern) {
			return true
		}
	}
	return false
}

func matchPath(path, pattern string) bool {
	switch {
	case strings.HasPrefix(pattern, "regex:"):
		re := pattern[6:]
		matched, _ := regexp.MatchString(re, path)
		return matched
	case strings.HasSuffix(pattern, "*"):
		prefix := strings.TrimSuffix(pattern, "*")
		return strings.HasPrefix(path, prefix)
	default:
		return path == pattern
	}
}

// HeaderPredicate matches requests by header presence or value.
type HeaderPredicate struct {
	Key   string
	Value string // empty means just check presence
}

func (h HeaderPredicate) Match(c *gin.Context) bool {
	value := c.GetHeader(h.Key)
	if h.Value == "" {
		return value != ""
	}
	return value == h.Value
}

// QueryPredicate matches requests by query parameter presence or value.
type QueryPredicate struct {
	Key   string
	Value string // empty means just check presence
}

func (q QueryPredicate) Match(c *gin.Context) bool {
	value := c.Query(q.Key)
	if q.Value == "" {
		return value != ""
	}
	return value == q.Value
}

// IPRangePredicate matches requests by client IP or CIDR range.
type IPRangePredicate struct {
	CIDRs []string
}

func (i IPRangePredicate) Match(c *gin.Context) bool {
	clientIP := c.ClientIP()
	for _, cidr := range i.CIDRs {
		if matchCIDR(clientIP, cidr) {
			return true
		}
	}
	return false
}

func matchCIDR(ip, cidr string) bool {
	if !strings.Contains(cidr, "/") {
		return ip == cidr
	}
	_, ipnet, err := net.ParseCIDR(cidr)
	if err != nil {
		return false
	}
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}
	return ipnet.Contains(parsedIP)
}

// HostPredicate matches requests by Host header.
type HostPredicate struct {
	Hosts []string
}

func (h HostPredicate) Match(c *gin.Context) bool {
	host := c.Request.Host
	// Remove port if present
	if colonIdx := strings.Index(host, ":"); colonIdx != -1 {
		host = host[:colonIdx]
	}
	for _, pattern := range h.Hosts {
		if pattern == host {
			return true
		}
		// Support *.example.com wildcard
		if strings.HasPrefix(pattern, "*.") {
			suffix := pattern[1:]
			if strings.HasSuffix(host, suffix) {
				return true
			}
		}
	}
	return false
}

// StatusCodePredicate matches responses by status code.
// This predicate is evaluated after the response, useful for logging/metrics filters.
type StatusCodePredicate struct {
	Code int
}

func (s StatusCodePredicate) Match(c *gin.Context) bool {
	return c.Writer.Status() == s.Code
}

// StatusCodeRangePredicate matches responses by status code range.
// Format: "2xx", "3xx", "4xx", "5xx" or specific ranges "200-299".
type StatusCodeRangePredicate struct {
	Ranges []string
}

func (s StatusCodeRangePredicate) Match(c *gin.Context) bool {
	status := c.Writer.Status()
	for _, r := range s.Ranges {
		if matchStatusRange(status, r) {
			return true
		}
	}
	return false
}

func matchStatusRange(status int, r string) bool {
	switch r {
	case "1xx":
		return status >= 100 && status < 200
	case "2xx":
		return status >= 200 && status < 300
	case "3xx":
		return status >= 300 && status < 400
	case "4xx":
		return status >= 400 && status < 500
	case "5xx":
		return status >= 500 && status < 600
	default:
		// Try "min-max" format
		if strings.Contains(r, "-") {
			parts := strings.Split(r, "-")
			if len(parts) == 2 {
				var min, max int
				if n, err := parseInt(parts[0]); err == nil {
					min = n
				} else {
					return false
				}
				if n, err := parseInt(parts[1]); err == nil {
					max = n
				} else {
					return false
				}
				return status >= min && status <= max
			}
		}
		return false
	}
}

// AlwaysPredicate always matches (for catch-all routes).
type AlwaysPredicate struct{}

func (AlwaysPredicate) Match(*gin.Context) bool { return true }

// NeverPredicate never matches.
type NeverPredicate struct{}

func (NeverPredicate) Match(*gin.Context) bool { return false }

// ContentTypePredicate matches requests by Content-Type header.
type ContentTypePredicate struct {
	Types []string
}

func (c ContentTypePredicate) Match(ctx *gin.Context) bool {
	contentType := ctx.GetHeader("Content-Type")
	if contentType == "" {
		return false
	}
	for _, t := range c.Types {
		if strings.HasPrefix(strings.ToLower(contentType), strings.ToLower(t)) {
			return true
		}
	}
	return false
}

// AcceptPredicate matches requests by Accept header.
type AcceptPredicate struct {
	Types []string
}

func (a AcceptPredicate) Match(c *gin.Context) bool {
	accept := c.GetHeader("Accept")
	if accept == "" || accept == "*/*" {
		return true
	}
	for _, t := range a.Types {
		if strings.Contains(accept, t) {
			return true
		}
	}
	return false
}

// RemoteAddrPredicate matches requests by remote address.
type RemoteAddrPredicate struct {
	Addresses []string
}

func (r RemoteAddrPredicate) Match(c *gin.Context) bool {
	addr := c.Request.RemoteAddr
	// Remove port if present
	if colonIdx := strings.LastIndex(addr, ":"); colonIdx != -1 {
		// Check if it's an IPv6 address
		if strings.Count(addr, ":") > 1 {
			if bracketIdx := strings.Index(addr, "["); bracketIdx == -1 {
				addr = addr[:colonIdx]
			}
		} else {
			addr = addr[:colonIdx]
		}
	}
	for _, a := range r.Addresses {
		if addr == a {
			return true
		}
	}
	return false
}

// PredicateFunc adapts a function to the Predicate interface.
type PredicateFunc func(*gin.Context) bool

func (f PredicateFunc) Match(c *gin.Context) bool {
	return f(c)
}

// parseInt parses a string to int.
func parseInt(s string) (int, error) {
	if s == "" {
		return 0, http.ErrNotSupported
	}
	n := 0
	negative := false
	if strings.HasPrefix(s, "-") {
		negative = true
		s = s[1:]
	}
	if s == "" {
		return 0, http.ErrNotSupported
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, http.ErrNotSupported
		}
		n = n*10 + int(c-'0')
	}
	if negative {
		n = -n
	}
	return n, nil
}
