package config

import (
	"fmt"
	"os"
)

type Config struct {
	Environment          string
	InternalServiceToken string
	DatabaseURL          string
	MigrationDatabaseURL string
	Port                 string
	SMTPHost             string
	SMTPPort             string
	SMTPUsername         string
	SMTPPassword         string
	FromEmail            string
}

func Load() *Config {
	return &Config{
		Environment:          getEnv("ENVIRONMENT", "development"),
		InternalServiceToken: getEnv("NOTIFICATION_INTERNAL_SERVICE_TOKEN", getEnv("INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
		DatabaseURL:          getEnv("NOTIFICATION_DATABASE_URL", ""),
		MigrationDatabaseURL: getEnv("NOTIFICATION_MIGRATION_DATABASE_URL", getEnv("NOTIFICATION_DATABASE_URL", "")),
		// Align with docs / .env.example: notification-service listens on 8084
		Port:         getEnv("NOTIFICATION_PORT", "8084"),
		SMTPHost:     getEnv("SMTP_HOST", "localhost"),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: getEnv("SMTP_USERNAME", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		FromEmail:    getEnv("FROM_EMAIL", "noreply@example.com"),
	}
}

func (c *Config) Validate() error {
	if c.Environment == "production" && (c.InternalServiceToken == "" || c.InternalServiceToken == "axi-development-internal-token") {
		return fmt.Errorf("NOTIFICATION_INTERNAL_SERVICE_TOKEN must be injected in production")
	}
	if c.Environment == "production" && c.DatabaseURL == "" {
		return fmt.Errorf("NOTIFICATION_DATABASE_URL must be injected in production")
	}
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
