package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/axi-workbench/platform-core/internal/config"
	"github.com/axi-workbench/platform-core/internal/httpapi"
	"github.com/axi-workbench/platform-core/internal/observability"
	"github.com/axi-workbench/platform-core/internal/outbox"
	"github.com/axi-workbench/platform-core/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("platform core configuration: %v", err)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	shutdownTelemetry, err := observability.Setup(context.Background(), "axi-platform-core", cfg.OTLPTracesEndpoint)
	if err != nil {
		log.Fatalf("platform core OpenTelemetry: %v", err)
	}
	defer func() {
		shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := shutdownTelemetry(shutdownContext); err != nil {
			logger.Error("flush OpenTelemetry trace exporter", "error", err)
		}
	}()
	var persistence store.Store
	if cfg.DatabaseURL == "" {
		logger.Warn("platform core is using in-memory persistence; this mode is development only")
		persistence = store.NewMemory(nil)
	} else {
		postgresStore, err := store.NewPostgres(context.Background(), cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("platform core persistence: %v", err)
		}
		persistence = postgresStore
	}
	defer persistence.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if cfg.OutboxWorkerEnabled {
		go func() {
			if err := (outbox.Worker{
				Store:     persistence,
				URL:       cfg.OutboxDeliveryURL,
				AuthToken: cfg.OutboxDeliveryAuthToken,
				Interval:  cfg.OutboxPollInterval,
				Logger:    logger,
			}).Run(ctx); err != nil {
				logger.Error("platform outbox worker stopped", "error", err)
			}
		}()
	}

	router := httpapi.New(cfg, persistence, logger).Router()
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()

	logger.Info("starting Axi platform core", "port", cfg.Port)
	select {
	case serverErr := <-serverErrors:
		if serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("platform core stopped unexpectedly", "error", serverErr)
		}
	case <-ctx.Done():
		logger.Info("shutting down Axi platform core")
		shutdownContext, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			logger.Error("gracefully shut down platform core", "error", err)
			_ = server.Close()
		}
		if serverErr := <-serverErrors; serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("platform core stopped with an error", "error", serverErr)
		}
	}
}
