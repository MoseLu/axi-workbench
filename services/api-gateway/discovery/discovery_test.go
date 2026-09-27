package discovery

import (
	"context"
	"testing"
	"time"
)

func TestStaticDiscovery(t *testing.T) {
	sd := NewStaticDiscovery()

	t.Run("GetService returns name as address", func(t *testing.T) {
		ctx := context.Background()
		addrs, err := sd.GetService(ctx, "http://localhost:8080")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(addrs) != 1 || addrs[0] != "http://localhost:8080" {
			t.Errorf("expected [http://localhost:8080], got %v", addrs)
		}
	})

	t.Run("Watch never changes", func(t *testing.T) {
		ctx := context.Background()
		called := false
		cancel := sd.Watch(ctx, "test", func(addrs []string) {
			called = true
		})
		defer cancel()

		if called {
			t.Error("Watch should not call callback immediately for static")
		}

		// Wait a bit and verify still not called
		time.Sleep(100 * time.Millisecond)
		if called {
			t.Error("Watch should never call callback for static")
		}
	})

	t.Run("Name returns static", func(t *testing.T) {
		if sd.Name() != "static" {
			t.Errorf("expected 'static', got %s", sd.Name())
		}
	})
}

func TestResolveURL(t *testing.T) {
	tests := []struct {
		name    string
		rawURL  string
		want    string
		wantErr bool
	}{
		{
			name:    "valid http",
			rawURL:  "http://localhost:8080",
			want:    "http://localhost:8080",
			wantErr: false,
		},
		{
			name:    "valid https",
			rawURL:  "https://api.example.com",
			want:    "https://api.example.com",
			wantErr: false,
		},
		{
			name:    "with port",
			rawURL:  "http://localhost:3000/api",
			want:    "http://localhost:3000/api",
			wantErr: false,
		},
		{
			name:    "empty",
			rawURL:  "",
			wantErr: true,
		},
		{
			name:    "no scheme",
			rawURL:  "localhost:8080",
			wantErr: true,
		},
		{
			name:    "no host",
			rawURL:  "http://",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResolveURL(tt.rawURL)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("ResolveURL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestResolver_StaticUpstream(t *testing.T) {
	r := NewResolver()
	r.RegisterUpstream(UpstreamConfig{
		Name:      "identity",
		Discovery: "static",
		URL:       "http://identity-service:8080",
	})

	ctx := context.Background()

	t.Run("GetAddress returns configured URL", func(t *testing.T) {
		addr, err := r.GetAddress(ctx, "identity")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if addr != "http://identity-service:8080" {
			t.Errorf("expected 'http://identity-service:8080', got %s", addr)
		}
	})

	t.Run("GetAddresses returns configured URL", func(t *testing.T) {
		addrs, err := r.GetAddresses(ctx, "identity")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(addrs) != 1 || addrs[0] != "http://identity-service:8080" {
			t.Errorf("expected [http://identity-service:8080], got %v", addrs)
		}
	})

	t.Run("unknown upstream returns error", func(t *testing.T) {
		_, err := r.GetAddress(ctx, "unknown")
		if err == nil {
			t.Error("expected error for unknown upstream")
		}
	})

	t.Run("static without URL returns error", func(t *testing.T) {
		r.RegisterUpstream(UpstreamConfig{
			Name:      "no-url",
			Discovery: "static",
		})
		_, err := r.GetAddress(ctx, "no-url")
		if err == nil {
			t.Error("expected error for static upstream without URL")
		}
	})
}

func TestResolver_RoundRobin(t *testing.T) {
	r := NewResolver()
	// Use a custom discovery type for testing round-robin
	r.RegisterUpstream(UpstreamConfig{
		Name:      "multi",
		Discovery: "mock-multi",
		URL:       "http://multi-1:8080",
	})
	r.RegisterDiscovery("mock-multi", &mockDiscovery{
		addresses: []string{"addr1:8080", "addr2:8080", "addr3:8080"},
	})

	ctx := context.Background()

	// Verify round-robin behavior
	seen := make(map[string]int)
	for i := 0; i < 12; i++ {
		addr, err := r.GetAddress(ctx, "multi")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		seen[addr]++
	}

	// Each address should be selected 4 times (12 / 3 = 4)
	for addr, count := range seen {
		if count != 4 {
			t.Errorf("address %s was selected %d times, expected 4", addr, count)
		}
	}
}

// mockDiscovery is a test helper.
type mockDiscovery struct {
	addresses []string
	watchCalls int
}

func (m *mockDiscovery) GetService(ctx context.Context, name string) ([]string, error) {
	return m.addresses, nil
}

func (m *mockDiscovery) Watch(ctx context.Context, name string, callback func([]string)) func() {
	m.watchCalls++
	return func() {}
}

func (m *mockDiscovery) Name() string {
	return "mock"
}
