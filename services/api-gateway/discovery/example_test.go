// Package discovery provides example usage of the discovery module.
// Run with: go test -v -run Example
package discovery

import (
	"context"
	"fmt"
)

// ExampleResolver shows how to configure and use the discovery resolver.
func ExampleResolver() {
	// Create resolver
	resolver := NewResolver()

	// Register static upstream
	resolver.RegisterUpstream(UpstreamConfig{
		Name:      "identity",
		Discovery: "static",
		URL:       "http://identity-service:8080",
	})

	ctx := context.Background()

	// Get single address (round-robin)
	addr, err := resolver.GetAddress(ctx, "identity")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Identity address: %s\n", addr)
	// Output: Identity address: http://identity-service:8080
}

// ExampleStaticDiscovery shows how to use static discovery.
func ExampleStaticDiscovery() {
	sd := NewStaticDiscovery()
	ctx := context.Background()

	addrs, err := sd.GetService(ctx, "http://my-service:8080")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Addresses: %v\n", addrs)
	// Output: Addresses: [http://my-service:8080]
}

// ExampleResolveURL shows URL validation.
func ExampleResolveURL() {
	url, err := ResolveURL("http://localhost:8080")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Resolved URL: %s\n", url)
	// Output: Resolved URL: http://localhost:8080
}
