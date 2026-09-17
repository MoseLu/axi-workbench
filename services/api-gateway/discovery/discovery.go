// Package discovery provides pluggable service discovery implementations.
// It follows a similar pattern to Spring Cloud Gateway's RouteDefinitionLocator,
// supporting static URLs, Consul, and Kubernetes Endpoints as discovery sources.
package discovery

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// ServiceDiscovery defines the interface for service discovery.
// Implementations should handle caching and refresh of service endpoints.
type ServiceDiscovery interface {
	// GetService returns a list of addresses for the given service name.
	// Returns an error if the service is not found or the discovery backend is unavailable.
	GetService(ctx context.Context, name string) ([]string, error)
	// Watch registers a callback to be notified when the service addresses change.
	// The callback receives the new list of addresses.
	// Watch should return a cancel function to stop watching.
	Watch(ctx context.Context, name string, callback func(addresses []string)) (cancel func())
	// Name returns the name of the discovery implementation.
	Name() string
}

// UpstreamConfig describes how to discover a single upstream service.
type UpstreamConfig struct {
	Name      string `yaml:"name"`       // Logical service name
	Discovery string `yaml:"discovery"` // Discovery type: "static", "consul", "kubernetes"

	// Static discovery
	URL string `yaml:"url"`

	// Consul discovery
	ConsulScheme string `yaml:"consulScheme"`
	ConsulHost  string `yaml:"consulHost"`
	ConsulPort  int    `yaml:"consulPort"`
	ConsulDC    string `yaml:"consulDatacenter"`

	// Kubernetes discovery
	K8sNamespace string `yaml:"k8sNamespace"`
	K8sService   string `yaml:"k8sService"`
	K8sPort      int    `yaml:"k8sPort"`
}

// Resolver manages multiple service discoveries and provides round-robin access.
type Resolver struct {
	discoveries map[string]ServiceDiscovery
	upstreams   map[string]UpstreamConfig
	mu          sync.RWMutex

	// Round-robin state per service
	rrCounters map[string]uint64
	rrMu       sync.Mutex
}

// NewResolver creates a new service resolver with the given configurations.
func NewResolver() *Resolver {
	return &Resolver{
		discoveries: make(map[string]ServiceDiscovery),
		upstreams:   make(map[string]UpstreamConfig),
		rrCounters:  make(map[string]uint64),
	}
}

// RegisterUpstream adds an upstream configuration.
func (r *Resolver) RegisterUpstream(cfg UpstreamConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.upstreams[cfg.Name] = cfg
}

// RegisterDiscovery registers a discovery implementation for a type.
func (r *Resolver) RegisterDiscovery(discoveryType string, sd ServiceDiscovery) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.discoveries[discoveryType] = sd
}

// GetAddress returns a single address for the given service using round-robin.
func (r *Resolver) GetAddress(ctx context.Context, name string) (string, error) {
	addresses, err := r.GetAddresses(ctx, name)
	if err != nil {
		return "", err
	}
	if len(addresses) == 0 {
		return "", fmt.Errorf("no addresses available for service %s", name)
	}

	// Round-robin selection
	r.rrMu.Lock()
	idx := r.rrCounters[name] % uint64(len(addresses))
	r.rrCounters[name]++
	r.rrMu.Unlock()

	return addresses[idx], nil
}

// GetAddresses returns all known addresses for the given service.
func (r *Resolver) GetAddresses(ctx context.Context, name string) ([]string, error) {
	r.mu.RLock()
	cfg, ok := r.upstreams[name]
	if !ok {
		r.mu.RUnlock()
		return nil, fmt.Errorf("upstream %s not configured", name)
	}

	// Handle static discovery specially - use URL from config
	if cfg.Discovery == "static" {
		url := cfg.URL
		r.mu.RUnlock()
		if url == "" {
			return nil, fmt.Errorf("static upstream %s has no URL configured", name)
		}
		return []string{url}, nil
	}

	discoveryType := cfg.Discovery
	sd, ok := r.discoveries[discoveryType]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("discovery type %s not registered", discoveryType)
	}

	return sd.GetService(ctx, name)
}

// Watch sets up a watch on a service and calls the callback when addresses change.
func (r *Resolver) Watch(ctx context.Context, name string, callback func(addresses []string)) (cancel func()) {
	r.mu.RLock()
	cfg, ok := r.upstreams[name]
	if !ok {
		r.mu.RUnlock()
		return func() {}
	}
	discoveryType := cfg.Discovery
	sd, ok := r.discoveries[discoveryType]
	r.mu.RUnlock()

	if !ok {
		return func() {}
	}

	return sd.Watch(ctx, name, callback)
}

// StaticResolver is a simple resolver that always returns the same address.
type StaticResolver struct {
	address string
}

// NewStaticResolver creates a new static resolver.
func NewStaticResolver(address string) *StaticResolver {
	return &StaticResolver{address: address}
}

// GetService implements ServiceDiscovery.
func (s *StaticResolver) GetService(ctx context.Context, name string) ([]string, error) {
	return []string{s.address}, nil
}

// Watch implements ServiceDiscovery.
func (s *StaticResolver) Watch(ctx context.Context, name string, callback func(addresses []string)) func() {
	// Static resolver never changes, but we call once with initial value
	callback([]string{s.address})
	return func() {}
}

// Name implements ServiceDiscovery.
func (s *StaticResolver) Name() string {
	return "static"
}

// RandomResolver wraps a StaticResolver but shuffles the result on each call.
// This is useful for basic load balancing when only one address is known.
type RandomResolver struct {
	StaticResolver
	mu    sync.Mutex
	seen  []string
	last  time.Time
	ttl   time.Duration
}

// NewRandomResolver creates a resolver that returns addresses in random order.
func NewRandomResolver(addresses []string, ttl time.Duration) *RandomResolver {
	return &RandomResolver{
		StaticResolver: StaticResolver{address: addresses[0]},
		seen:           addresses,
		last:          time.Now(),
		ttl:           ttl,
	}
}

// GetService implements ServiceDiscovery.
func (r *RandomResolver) GetService(ctx context.Context, name string) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Refresh if stale
	if time.Since(r.last) > r.ttl {
		// In a real implementation, this would re-fetch from the source
		r.last = time.Now()
	}

	// Shuffle using Fisher-Yates
	result := make([]string, len(r.seen))
	copy(result, r.seen)
	rand.Shuffle(len(result), func(i, j int) {
		result[i], result[j] = result[j], result[i]
	})

	return result, nil
}

// Watch implements ServiceDiscovery.
func (r *RandomResolver) Watch(ctx context.Context, name string, callback func(addresses []string)) func() {
	return func() {}
}

// Name implements ServiceDiscovery.
func (r *RandomResolver) Name() string {
	return "random"
}
