// Package discovery provides Consul-based service discovery.
package discovery

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/hashicorp/consul/api"
)

// ConsulDiscovery implements service discovery using HashiCorp Consul.
type ConsulDiscovery struct {
	client *api.Client

	// Cache for resolved addresses
	cache     map[string][]string
	cacheMu   sync.RWMutex
	cacheTime map[string]time.Time
	ttl       time.Duration

	// Watch callbacks - use ID-based tracking to avoid function comparison
	watches        map[string]map[uint64]func([]string)
	watchesMu      sync.RWMutex
	stopChans      map[string]chan struct{}
	nextCallbackID  uint64
}

// ConsulDiscoveryConfig holds configuration for ConsulDiscovery.
type ConsulDiscoveryConfig struct {
	// Address is the Consul agent address (e.g., "consul.service.consul:8500").
	Address string

	// Datacenter is the Consul datacenter to query.
	Datacenter string

	// Token is the ACL token for Consul API.
	Token string

	// TTL is how long to cache service addresses before refreshing.
	TTL time.Duration
}

// NewConsulDiscovery creates a new Consul-based service discovery.
func NewConsulDiscovery(ctx context.Context, cfg ConsulDiscoveryConfig) (*ConsulDiscovery, error) {
	config := api.DefaultConfig()
	if cfg.Address != "" {
		config.Address = cfg.Address
	}
	if cfg.Token != "" {
		config.Token = cfg.Token
	}
	if cfg.Datacenter != "" {
		config.Datacenter = cfg.Datacenter
	}

	client, err := api.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create Consul client: %w", err)
	}

	ttl := cfg.TTL
	if ttl == 0 {
		ttl = 30 * time.Second
	}

	return &ConsulDiscovery{
		client:         client,
		cache:          make(map[string][]string),
		cacheTime:      make(map[string]time.Time),
		ttl:            ttl,
		watches:        make(map[string]map[uint64]func([]string)),
		stopChans:      make(map[string]chan struct{}),
		nextCallbackID:  1,
	}, nil
}

// GetService implements ServiceDiscovery.
func (c *ConsulDiscovery) GetService(ctx context.Context, name string) ([]string, error) {
	// Check cache first
	c.cacheMu.RLock()
	if addrs, ok := c.cache[name]; ok {
		if time.Since(c.cacheTime[name]) < c.ttl {
			c.cacheMu.RUnlock()
			return addrs, nil
		}
	}
	c.cacheMu.RUnlock()

	// Fetch fresh service catalog
	return c.fetchService(ctx, name)
}

// fetchService fetches service instances from Consul.
func (c *ConsulDiscovery) fetchService(ctx context.Context, name string) ([]string, error) {
	catalog := c.client.Catalog()

	// Query for service instances
	services, _, err := catalog.Service(name, "", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to query Consul for service %s: %w", name, err)
	}

	if len(services) == 0 {
		return nil, fmt.Errorf("no instances found for service %s", name)
	}

	addresses := make([]string, 0, len(services))
	for _, svc := range services {
		addr := fmt.Sprintf("%s:%d", svc.ServiceAddress, svc.ServicePort)
		if svc.ServiceAddress == "" {
			addr = fmt.Sprintf("%s:%d", svc.Address, svc.ServicePort)
		}
		addresses = append(addresses, addr)
	}

	// Update cache
	c.cacheMu.Lock()
	c.cache[name] = addresses
	c.cacheTime[name] = time.Now()
	c.cacheMu.Unlock()

	return addresses, nil
}

// Watch implements ServiceDiscovery.
func (c *ConsulDiscovery) Watch(ctx context.Context, name string, callback func(addresses []string)) func() {
	// Generate unique callback ID
	callbackID := atomic.AddUint64(&c.nextCallbackID, 1) - 1

	stopCh := make(chan struct{})

	c.watchesMu.Lock()
	if c.watches[name] == nil {
		c.watches[name] = make(map[uint64]func([]string))
	}
	c.watches[name][callbackID] = callback
	_, alreadyWatching := c.stopChans[name]
	if !alreadyWatching {
		c.stopChans[name] = stopCh
	}
	c.watchesMu.Unlock()

	if !alreadyWatching {
		// Start watch goroutine with periodic polling
		go func() {
			// Initial fetch
			addrs, err := c.fetchService(ctx, name)
			if err == nil {
				c.notifyWatches(name, addrs)
			}

			// Poll for changes
			ticker := time.NewTicker(c.ttl)
			defer ticker.Stop()

			for {
				select {
				case <-stopCh:
					return
				case <-ctx.Done():
					return
				case <-ticker.C:
					addrs, err := c.fetchService(ctx, name)
					if err != nil {
						continue
					}
					c.notifyWatches(name, addrs)
				}
			}
		}()
	}

	// Return cancel function that uses the callback ID
	return func() {
		c.watchesMu.Lock()
		defer c.watchesMu.Unlock()
		delete(c.watches[name], callbackID)
		if len(c.watches[name]) == 0 {
			select {
			case c.stopChans[name] <- struct{}{}:
			default:
			}
		}
	}
}

// notifyWatches notifies all registered callbacks for a service.
func (c *ConsulDiscovery) notifyWatches(name string, addresses []string) {
	c.watchesMu.RLock()
	callbacks := c.watches[name]
	c.watchesMu.RUnlock()

	for _, cb := range callbacks {
		cb(addresses)
	}
}

// Name implements ServiceDiscovery.
func (c *ConsulDiscovery) Name() string {
	return "consul"
}
