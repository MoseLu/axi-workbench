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

	"github.com/axi-workbench/identity-adapter/internal/config"
	"github.com/axi-workbench/identity-adapter/internal/email"
	"github.com/axi-workbench/identity-adapter/internal/httpapi"
	"github.com/axi-workbench/identity-adapter/internal/observability"
	"github.com/axi-workbench/identity-adapter/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("identity adapter configuration: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	shutdownTelemetry, err := observability.Setup(context.Background(), "axi-identity-adapter", cfg.OTLPTracesEndpoint)
	if err != nil {
		log.Fatalf("identity adapter OpenTelemetry: %v", err)
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
		logger.Warn("identity adapter is using in-memory persistence; this mode is development only")
		persistence = store.NewMemory(nil)
	} else {
		postgresStore, err := store.NewPostgres(context.Background(), cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("identity adapter persistence: %v", err)
		}
		persistence = postgresStore
		if cfg.RedisURL != "" {
			redisStore, err := store.NewRedisQR(context.Background(), cfg.RedisURL, postgresStore, nil)
			if err != nil {
				postgresStore.Close()
				log.Fatalf("identity QR transaction store: %v", err)
			}
			persistence = redisStore
		}
	}
	defer persistence.Close()

	var sender email.Sender = email.LogSender{Logger: logger}
	if cfg.EmailDelivery == "smtp" {
		sender = email.SMTPSender{
			Host:          cfg.SMTPHost,
			Port:          cfg.SMTPPort,
			Username:      cfg.SMTPUsername,
			Password:      cfg.SMTPPassword,
			From:          cfg.SMTPFrom,
			AllowInsecure: cfg.SMTPAllowInsecure,
			Timeout:       10 * time.Second,
		}
	}

	router := httpapi.New(cfg, persistence, sender, nil, logger).Router()
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()

	logger.Info("starting Axi identity adapter", "port", cfg.Port)
	select {
	case serverErr := <-serverErrors:
		if serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("identity adapter stopped unexpectedly", "error", serverErr)
		}
	case <-shutdownSignal.Done():
		logger.Info("shutting down Axi identity adapter")
		shutdownContext, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			logger.Error("gracefully shut down identity adapter", "error", err)
			_ = server.Close()
		}
		if serverErr := <-serverErrors; serverErr != nil && !errors.Is(serverErr, http.ErrServerClosed) {
			logger.Error("identity adapter stopped with an error", "error", serverErr)
		}
	}
}
