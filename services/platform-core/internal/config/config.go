package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	Environment             string
	Port                    string
	DatabaseURL             string
	InternalServiceToken    string
	OutboxWorkerEnabled     bool
	OutboxPollInterval      time.Duration
	OutboxDeliveryURL       string
	OutboxDeliveryAuthToken string
	OTLPTracesEndpoint      string
}

func Load() (Config, error) {
	return load(true)
}

// LoadForMigration deliberately omits runtime-only outbox validation. A
// migration job must not be blocked by a disabled or separately configured
// delivery worker; it only needs the migration database credential.
func LoadForMigration() (Config, error) {
	return load(false)
}

func load(validateOutboxWorker bool) (Config, error) {
	cfg := Config{
		Environment:             getEnv("ENVIRONMENT", "development"),
		Port:                    getEnv("PLATFORM_CORE_PORT", getEnv("PORT", "8082")),
		DatabaseURL:             os.Getenv("PLATFORM_DATABASE_URL"),
		InternalServiceToken:    getEnv("PLATFORM_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token"),
		OutboxWorkerEnabled:     getBool("PLATFORM_OUTBOX_WORKER", false),
		OutboxPollInterval:      getDuration("PLATFORM_OUTBOX_POLL_INTERVAL", 5*time.Second),
		OutboxDeliveryURL:       os.Getenv("PLATFORM_OUTBOX_DELIVERY_URL"),
		OutboxDeliveryAuthToken: os.Getenv("PLATFORM_OUTBOX_DELIVERY_AUTH_TOKEN"),
		OTLPTracesEndpoint:      strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
	}
	if err := cfg.validate(validateOutboxWorker); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error { return c.validate(true) }

func (c Config) validate(validateOutboxWorker bool) error {
	if c.OutboxPollInterval <= 0 {
		return fmt.Errorf("PLATFORM_OUTBOX_POLL_INTERVAL must be positive")
	}
	if c.Environment == "production" {
		if c.DatabaseURL == "" {
			return fmt.Errorf("PLATFORM_DATABASE_URL is required in production")
		}
		if c.InternalServiceToken == "" || c.InternalServiceToken == "axi-development-internal-token" {
			return fmt.Errorf("PLATFORM_INTERNAL_SERVICE_TOKEN must be injected in production")
		}
	}
	if validateOutboxWorker && c.OutboxWorkerEnabled && c.OutboxDeliveryURL == "" {
		return fmt.Errorf("PLATFORM_OUTBOX_DELIVERY_URL is required when the outbox worker is enabled")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value == "1" || strings.EqualFold(value, "true") || strings.EqualFold(value, "yes")
}
