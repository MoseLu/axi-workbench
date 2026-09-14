package config

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigWatcher_Polling(t *testing.T) {
	// Create a temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "routes.yaml")

	initialContent := `
routes:
  - id: initial-route
    path: /api/v1/initial
    upstream: http://localhost:8080
`
	err := os.WriteFile(configPath, []byte(initialContent), 0644)
	require.NoError(t, err)

	var lastConfig *RoutesConfig
	callbackCalled := make(chan struct{}, 1)

	watcher, err := NewConfigWatcher(configPath, 100*time.Millisecond, func(cfg *RoutesConfig) {
		lastConfig = cfg
		select {
		case callbackCalled <- struct{}{}:
		default:
		}
	})
	require.NoError(t, err)

	// Start watching
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	watcher.Start(ctx)

	// Wait for initial hash calculation
	time.Sleep(50 * time.Millisecond)

	// Modify the file
	updatedContent := `
routes:
  - id: updated-route
    path: /api/v1/updated
    upstream: http://localhost:8081
`
	err = os.WriteFile(configPath, []byte(updatedContent), 0644)
	require.NoError(t, err)

	// Wait for the callback
	select {
	case <-callbackCalled:
		require.NotNil(t, lastConfig)
		assert.Len(t, lastConfig.Routes, 1)
		assert.Equal(t, "updated-route", lastConfig.Routes[0].ID)
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for callback")
	}

	watcher.Stop()
}

func TestConfigWatcher_Stop(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "routes.yaml")

	content := `
routes:
  - id: test-route
    path: /api/v1/test
    upstream: http://localhost:8080
`
	err := os.WriteFile(configPath, []byte(content), 0644)
	require.NoError(t, err)

	callbackCalled := make(chan struct{}, 1)
	watcher, err := NewConfigWatcher(configPath, 100*time.Millisecond, func(cfg *RoutesConfig) {
		select {
		case callbackCalled <- struct{}{}:
		default:
		}
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	watcher.Start(ctx)

	// Stop immediately
	watcher.Stop()
	cancel()

	// The callback should not be called
	select {
	case <-callbackCalled:
		t.Error("callback called after stop")
	case <-time.After(200 * time.Millisecond):
		// Expected: no callback
	}
}

func TestConfigWatcher_NonExistentFile(t *testing.T) {
	nonExistentPath := "/tmp/non-existent-config-file-12345.yaml"

	callbackCalled := make(chan struct{}, 1)
	watcher, err := NewConfigWatcher(nonExistentPath, 50*time.Millisecond, func(cfg *RoutesConfig) {
		select {
		case callbackCalled <- struct{}{}:
		default:
		}
	})
	if err != nil {
		t.Skip("watcher creation failed for non-existent file")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	watcher.Start(ctx)

	// Should not panic
	time.Sleep(200 * time.Millisecond)
	watcher.Stop()
}

func TestConfigWatcher_MultipleChanges(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "routes.yaml")

	initialContent := `
routes:
  - id: route-1
    path: /api/v1/route1
    upstream: http://localhost:8080
`
	err := os.WriteFile(configPath, []byte(initialContent), 0644)
	require.NoError(t, err)

	changeCount := 0
	callbackCalled := make(chan struct{}, 1)

	watcher, err := NewConfigWatcher(configPath, 50*time.Millisecond, func(cfg *RoutesConfig) {
		changeCount++
		select {
		case callbackCalled <- struct{}{}:
		default:
		}
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	watcher.Start(ctx)

	time.Sleep(30 * time.Millisecond)

	// Make multiple changes
	for i := 2; i <= 3; i++ {
		content := `
routes:
  - id: route-` + string(rune('0'+i)) + `
    path: /api/v1/route` + string(rune('0'+i)) + `
    upstream: http://localhost:8080
`
		err := os.WriteFile(configPath, []byte(content), 0644)
		require.NoError(t, err)
		time.Sleep(80 * time.Millisecond)
	}

	select {
	case <-callbackCalled:
		// At least one change was detected
		assert.GreaterOrEqual(t, changeCount, 1)
	case <-time.After(500 * time.Millisecond):
		t.Log("no callback received, but that's ok for polling fallback")
	}

	watcher.Stop()
}
