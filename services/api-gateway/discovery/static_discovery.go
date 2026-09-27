// Package discovery provides static service discovery with URL fallback.
package discovery

import (
	"context"
	"net/url"
)

// StaticDiscovery implements static URL-based service discovery.
// This serves as the fallback when no dynamic discovery is configured.
type StaticDiscovery struct{}

// NewStaticDiscovery creates a new static service discovery.
func NewStaticDiscovery() *StaticDiscovery {
	return &StaticDiscovery{}
}

// GetService implements ServiceDiscovery.
func (s *StaticDiscovery) GetService(ctx context.Context, name string) ([]string, error) {
	// The URL is stored in the upstream config, not here
	// This returns the name as-is, expecting the Resolver to use the URL from config
	return []string{name}, nil
}

// Watch implements ServiceDiscovery.
func (s *StaticDiscovery) Watch(ctx context.Context, name string, callback func(addresses []string)) func() {
	// Static discovery never changes
	return func() {}
}

// Name implements ServiceDiscovery.
func (s *StaticDiscovery) Name() string {
	return "static"
}

// ResolveURL validates and returns the static URL.
func ResolveURL(rawURL string) (string, error) {
	if rawURL == "" {
		return "", ErrEmptyURL
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return "", ErrInvalidURL
	}

	if u.Scheme == "" || u.Host == "" {
		return "", ErrInvalidURL
	}

	// Normalize the URL
	if u.Scheme == "http" && u.Port() == "80" {
		u.Host = u.Hostname()
	} else if u.Scheme == "https" && u.Port() == "443" {
		u.Host = u.Hostname()
	}

	return u.String(), nil
}

// Errors for static discovery.
type StaticDiscoveryError struct {
	Message string
}

func (e *StaticDiscoveryError) Error() string {
	return e.Message
}

var (
	ErrEmptyURL   = &StaticDiscoveryError{Message: "URL is empty"}
	ErrInvalidURL = &StaticDiscoveryError{Message: "URL is invalid or missing scheme/host"}
)
