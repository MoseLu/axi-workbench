// Package discovery provides Kubernetes-based service discovery using Endpoints API.
package discovery

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// K8sDiscovery implements service discovery using Kubernetes Endpoints.
type K8sDiscovery struct {
	client    *kubernetes.Clientset
	namespace string

	// Cache for resolved addresses
	cache     map[string][]string
	cacheMu   sync.RWMutex
	cacheTime map[string]time.Time
	ttl       time.Duration

	// Watch callbacks - use ID-based tracking to avoid function comparison
	watches      map[string]map[uint64]func([]string)
	watchesMu    sync.RWMutex
	stopChans    map[string]chan struct{}
	nextCallbackID uint64
}

// K8sDiscoveryConfig holds configuration for K8sDiscovery.
type K8sDiscoveryConfig struct {
	// Namespace is the Kubernetes namespace to look up services in.
	// If empty, uses the namespace from the pod's service account.
	Namespace string

	// TTL is how long to cache endpoint addresses before refreshing.
	TTL time.Duration

	// InClusterConfig indicates whether to use the in-cluster config.
	// If false, tries to load from ~/.kube/config.
	InClusterConfig bool

	// Kubeconfig is the path to the kubeconfig file (used when InClusterConfig is false).
	Kubeconfig string
}

// NewK8sDiscovery creates a new Kubernetes-based service discovery.
// It uses the Kubernetes Endpoints API to discover service addresses.
func NewK8sDiscovery(ctx context.Context, cfg K8sDiscoveryConfig) (*K8sDiscovery, error) {
	var restCfg *rest.Config
	var err error

	if cfg.InClusterConfig {
		restCfg, err = rest.InClusterConfig()
	} else {
		restCfg, err = buildOutOfClusterConfig(cfg.Kubeconfig)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	namespace := cfg.Namespace
	if namespace == "" {
		// Try to get namespace from the pod's service account
		nsBytes, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
		if err == nil && len(nsBytes) > 0 {
			namespace = string(nsBytes)
		} else {
			namespace = "default"
		}
	}

	ttl := cfg.TTL
	if ttl == 0 {
		ttl = 30 * time.Second
	}

	return &K8sDiscovery{
		client:         clientset,
		namespace:      namespace,
		cache:          make(map[string][]string),
		cacheTime:      make(map[string]time.Time),
		ttl:            ttl,
		watches:        make(map[string]map[uint64]func([]string)),
		stopChans:      make(map[string]chan struct{}),
		nextCallbackID: 1,
	}, nil
}

// buildOutOfClusterConfig builds config from kubeconfig file.
func buildOutOfClusterConfig(kubeconfig string) (*rest.Config, error) {
	if kubeconfig == "" {
		// Try default locations
		home, err := os.UserHomeDir()
		if err == nil {
			kubeconfig = filepath.Join(home, ".kube", "config")
			if _, err := os.Stat(kubeconfig); os.IsNotExist(err) {
				kubeconfig = ""
			}
		}
	}
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}

// GetService implements ServiceDiscovery.
func (k *K8sDiscovery) GetService(ctx context.Context, name string) ([]string, error) {
	// Check cache first
	k.cacheMu.RLock()
	if addrs, ok := k.cache[name]; ok {
		if time.Since(k.cacheTime[name]) < k.ttl {
			k.cacheMu.RUnlock()
			return addrs, nil
		}
	}
	k.cacheMu.RUnlock()

	// Fetch fresh endpoints
	return k.fetchEndpoints(ctx, name)
}

// fetchEndpoints fetches endpoints from Kubernetes API.
func (k *K8sDiscovery) fetchEndpoints(ctx context.Context, name string) ([]string, error) {
	// Try to parse name as namespace/service format
	namespace := k.namespace
	serviceName := name
	if ns, svc, ok := parseCompoundName(name); ok {
		namespace = ns
		serviceName = svc
	}

	// Get Endpoints
	endpoints, err := k.client.CoreV1().Endpoints(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get endpoints for %s: %w", name, err)
	}

	addresses := k.extractAddresses(endpoints)
	if len(addresses) == 0 {
		return nil, fmt.Errorf("no addresses found for service %s", name)
	}

	// Update cache
	k.cacheMu.Lock()
	k.cache[name] = addresses
	k.cacheTime[name] = time.Now()
	k.cacheMu.Unlock()

	return addresses, nil
}

// extractAddresses extracts IP:Port pairs from Endpoints.
func (k *K8sDiscovery) extractAddresses(endpoints *corev1.Endpoints) []string {
	var addresses []string
	port := ""

	// Find the first port (or target port)
	if len(endpoints.Subsets) > 0 && len(endpoints.Subsets[0].Ports) > 0 {
		port = fmt.Sprintf(":%d", endpoints.Subsets[0].Ports[0].Port)
	}

	for _, subset := range endpoints.Subsets {
		for _, addr := range subset.Addresses {
			if addr.IP != "" {
				// Use the port from this subset if different
				targetPort := port
				if len(subset.Ports) > 0 {
					targetPort = fmt.Sprintf(":%d", subset.Ports[0].Port)
				}
				addresses = append(addresses, net.JoinHostPort(addr.IP, targetPort[1:]))
			}
		}
	}

	return addresses
}

// Watch implements ServiceDiscovery.
func (k *K8sDiscovery) Watch(ctx context.Context, name string, callback func(addresses []string)) func() {
	// Parse namespace from name if compound
	namespace := k.namespace
	serviceName := name
	if ns, svc, ok := parseCompoundName(name); ok {
		namespace = ns
		serviceName = svc
	}

	// Generate unique callback ID
	callbackID := atomic.AddUint64(&k.nextCallbackID, 1) - 1

	stopCh := make(chan struct{})

	k.watchesMu.Lock()
	if k.watches[name] == nil {
		k.watches[name] = make(map[uint64]func([]string))
	}
	k.watches[name][callbackID] = callback
	_, alreadyWatching := k.stopChans[name]
	if !alreadyWatching {
		k.stopChans[name] = stopCh
	}
	k.watchesMu.Unlock()

	if !alreadyWatching {
		// Start watch goroutine with periodic polling
		go func() {
			// Initial fetch
			addrs, err := k.fetchEndpointsWithNS(ctx, namespace, serviceName)
			if err == nil {
				k.notifyWatches(name, addrs)
			}

			// Poll for changes
			ticker := time.NewTicker(k.ttl)
			defer ticker.Stop()

			for {
				select {
				case <-stopCh:
					return
				case <-ctx.Done():
					return
				case <-ticker.C:
					addrs, err := k.fetchEndpointsWithNS(ctx, namespace, serviceName)
					if err != nil {
						continue
					}
					k.notifyWatches(name, addrs)
				}
			}
		}()
	}

	// Return cancel function that uses the callback ID
	return func() {
		k.watchesMu.Lock()
		defer k.watchesMu.Unlock()
		delete(k.watches[name], callbackID)
		if len(k.watches[name]) == 0 {
			select {
			case k.stopChans[name] <- struct{}{}:
			default:
			}
		}
	}
}

// fetchEndpointsWithNS fetches endpoints with explicit namespace.
func (k *K8sDiscovery) fetchEndpointsWithNS(ctx context.Context, namespace, serviceName string) ([]string, error) {
	endpoints, err := k.client.CoreV1().Endpoints(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get endpoints for %s: %w", serviceName, err)
	}

	addresses := k.extractAddresses(endpoints)
	if len(addresses) == 0 {
		return nil, fmt.Errorf("no addresses found for service %s", serviceName)
	}

	// Update cache
	k.cacheMu.Lock()
	cacheKey := serviceName
	if namespace != k.namespace {
		cacheKey = namespace + "/" + serviceName
	}
	k.cache[cacheKey] = addresses
	k.cacheTime[cacheKey] = time.Now()
	k.cacheMu.Unlock()

	return addresses, nil
}

// notifyWatches notifies all registered callbacks for a service.
func (k *K8sDiscovery) notifyWatches(name string, addresses []string) {
	k.watchesMu.RLock()
	callbacks := k.watches[name]
	k.watchesMu.RUnlock()

	for _, cb := range callbacks {
		cb(addresses)
	}
}

// Name implements ServiceDiscovery.
func (k *K8sDiscovery) Name() string {
	return "kubernetes"
}

// parseCompoundName parses "namespace/service" format.
func parseCompoundName(name string) (namespace, service string, ok bool) {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '/' {
			namespace = name[:i]
			service = name[i+1:]
			if namespace != "" && service != "" {
				return namespace, service, true
			}
		}
	}
	return "", "", false
}
