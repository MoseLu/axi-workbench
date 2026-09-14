package config

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// ConfigWatcher monitors configuration files for changes and triggers callbacks.
// It uses fsnotify for efficient file system event detection with polling fallback.
type ConfigWatcher struct {
	path       string
	interval   time.Duration
	onChange   func(*RoutesConfig)
	pollTicker *time.Ticker
	done       chan struct{}
	logger     zerolog.Logger
	mu         sync.RWMutex
	lastHash   uint64
	fsWatcher  *fsnotify.Watcher
}

// NewConfigWatcher creates a new configuration watcher.
// The onChange callback is called when the configuration file changes.
// Uses fsnotify when available, falls back to polling otherwise.
func NewConfigWatcher(path string, interval time.Duration, onChange func(*RoutesConfig)) (*ConfigWatcher, error) {
	logger := log.With().Str("component", "config_watcher").Str("path", path).Logger()

	cw := &ConfigWatcher{
		path:     path,
		interval: interval,
		onChange: onChange,
		done:     make(chan struct{}),
		logger:   logger,
	}

	// Try to use fsnotify
	if err := cw.setupFsnotify(); err != nil {
		logger.Warn().Err(err).Msg("fsnotify not available, using polling fallback")
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
	cw.logger.Info().Str("dir", dir).Msg("using fsnotify for file watching")
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

	// Start fsnotify watcher if available
	if cw.fsWatcher != nil {
		go cw.fsWatchLoop(ctx)
	}

	// Always start polling as a fallback/primary mechanism
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
			select {
			case <-ctx.Done():
				return
			case <-cw.done:
				return
			}
			continue
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
					cw.logger.Info().Str("event", event.String()).Msg("fsnotify detected config change")
					cw.triggerReload()
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			cw.logger.Warn().Err(err).Msg("fsnotify error")
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
			select {
			case <-ctx.Done():
				return
			case <-cw.done:
				return
			}
			continue
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
	cw.logger.Info().Msg("configuration file changed, reloading")

	// Reload configuration
	cfg, err := LoadRoutes(cw.path)
	if err != nil {
		cw.logger.Error().Err(err).Msg("failed to reload configuration")
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
