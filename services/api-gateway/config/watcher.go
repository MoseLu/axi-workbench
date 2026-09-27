package config

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/axiomaticworld/observability/go/axilog"
	"github.com/fsnotify/fsnotify"
)

// ConfigWatcher monitors configuration files for changes and triggers callbacks.
// It uses fsnotify for efficient file system event detection with polling fallback.
type ConfigWatcher struct {
	path       string
	interval   time.Duration
	onChange   func(*RoutesConfig)
	pollTicker *time.Ticker
	done       chan struct{}
	logger     *slog.Logger
	mu         sync.RWMutex
	lastHash   uint64
	fsWatcher  *fsnotify.Watcher
}

// NewConfigWatcher creates a new configuration watcher.
// The onChange callback is called when the configuration file changes.
// Uses fsnotify when available, falls back to polling otherwise.
func NewConfigWatcher(path string, interval time.Duration, onChange func(*RoutesConfig)) (*ConfigWatcher, error) {
	logger := axilog.New(axilog.Options{
		Service: axilog.WithService("axi-api-gateway"),
	}).With(
		slog.String("component", "config_watcher"),
		slog.String("path", path),
	)

	cw := &ConfigWatcher{
		path:     path,
		interval: interval,
		onChange: onChange,
		done:     make(chan struct{}),
		logger:   logger,
	}

	// Try to use fsnotify
	if err := cw.setupFsnotify(); err != nil {
		logger.Warn("fsnotify not available, using polling fallback", slog.Any("error", err))
		if interval < 5*time.Second {
			cw.interval = 5 * time.Second
		}
	}

	// Calculate initial hash
	cw.updateHash()

	return cw, nil
}

// setupFsnotify attempts to set up filesystem event watching using fsnotify.
func (cw *ConfigWatcher) setupFsnotify() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	// Watch the directory containing the config file
	dir := filepath.Dir(cw.path)
	if err := watcher.Add(dir); err != nil {
		watcher.Close()
		return err
	}

	cw.fsWatcher = watcher
	cw.logger.Info("using fsnotify for file watching", slog.String("dir", dir))
	return nil
}

// Start begins watching the configuration file.
func (cw *ConfigWatcher) Start(ctx context.Context) {
	cw.mu.Lock()
	if cw.pollTicker != nil {
		cw.mu.Unlock()
		return
	}
	cw.mu.Unlock()

	// Start fsnotify watcher if available - this is the primary mechanism
	if cw.fsWatcher != nil {
		go cw.fsWatchLoop(ctx)
		// fsnotify is reliable, no need for polling as fallback
		return
	}

	// Fallback: use polling when fsnotify is not available
	cw.mu.Lock()
	cw.pollTicker = time.NewTicker(cw.interval)
	cw.mu.Unlock()
	go cw.pollLoop(ctx)
}

// fsWatchLoop handles fsnotify events.
func (cw *ConfigWatcher) fsWatchLoop(ctx context.Context) {
	for {
		cw.mu.RLock()
		watcher := cw.fsWatcher
		cw.mu.RUnlock()

		if watcher == nil {
			return // fsnotify not available, polling handles everything
		}

		select {
		case <-ctx.Done():
			return
		case <-cw.done:
			return
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if filepath.Base(event.Name) == filepath.Base(cw.path) {
				if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
					cw.logger.Info("fsnotify detected config change", slog.String("event", event.String()))
					cw.triggerReload()
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			cw.logger.Warn("fsnotify error", slog.Any("error", err))
		}
	}
}

// pollLoop continuously checks for file changes using polling as fallback.
func (cw *ConfigWatcher) pollLoop(ctx context.Context) {
	for {
		cw.mu.RLock()
		ticker := cw.pollTicker
		cw.mu.RUnlock()

		if ticker == nil {
			// Ticker was stopped, exit gracefully
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-cw.done:
			return
		case <-ticker.C:
			cw.checkForChanges()
		}
	}
}

// checkForChanges checks if the configuration file has changed.
func (cw *ConfigWatcher) checkForChanges() {
	cw.mu.RLock()
	currentHash := cw.getFileHash()
	cw.mu.RUnlock()

	if currentHash == 0 {
		return
	}

	cw.mu.Lock()
	changed := currentHash != cw.lastHash
	if changed {
		cw.lastHash = currentHash
	}
	cw.mu.Unlock()

	if !changed {
		return
	}

	cw.triggerReload()
}

// triggerReload triggers the configuration reload callback.
func (cw *ConfigWatcher) triggerReload() {
	cw.logger.Info("configuration file changed, reloading")

	// Reload configuration
	cfg, err := LoadRoutes(cw.path)
	if err != nil {
		cw.logger.Error("failed to reload configuration", slog.Any("error", err))
		return
	}

	// Trigger callback with the new configuration
	if cw.onChange != nil {
		cfg.mu.RLock()
		routesConfig := &RoutesConfig{
			Routes:      cfg.GetRoutes(),
			RouteGroups: cfg.GetRouteGroups(),
		}
		cfg.mu.RUnlock()
		cw.onChange(routesConfig)
	}
}

// getFileHash returns a hash based on file size and modification time.
func (cw *ConfigWatcher) getFileHash() uint64 {
	info, err := os.Stat(cw.path)
	if err != nil {
		return 0
	}

	// Simple hash combining size and mtime
	size := info.Size()
	mtime := info.ModTime().UnixNano()
	return uint64(size)<<32 ^ uint64(mtime)
}

// updateHash updates the last known file hash.
func (cw *ConfigWatcher) updateHash() {
	cw.lastHash = cw.getFileHash()
}

// Stop stops the configuration watcher.
func (cw *ConfigWatcher) Stop() {
	cw.mu.Lock()
	defer cw.mu.Unlock()

	close(cw.done)

	if cw.pollTicker != nil {
		cw.pollTicker.Stop()
		cw.pollTicker = nil
	}

	if cw.fsWatcher != nil {
		cw.fsWatcher.Close()
		cw.fsWatcher = nil
	}
}
