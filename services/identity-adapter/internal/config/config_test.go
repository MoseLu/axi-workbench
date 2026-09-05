package config

import (
	"strings"
	"testing"
	"time"
)

func TestProductionRejectsInsecureSMTP(t *testing.T) {
	cfg := Config{
		Environment:                  "production",
		DatabaseURL:                  "postgres://identity",
		RedisURL:                     "redis://identity",
		InternalServiceToken:         "internal-token",
		ZitadelWebhookSecret:         "webhook-secret",
		QRTransactionTTL:             time.Minute,
		EmailVerificationTTL:         time.Minute,
		EmailVerificationMaxAttempts: 5,
		EmailVerificationPepper:      "pepper",
		OwnerEmail:                   "owner@example.com",
		EmailDelivery:                "smtp",
		SMTPHost:                     "smtp.example.com",
		SMTPUsername:                 "user",
		SMTPPassword:                 "password",
		SMTPFrom:                     "axi@example.com",
		SMTPAllowInsecure:            true,
	}
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "SMTP_ALLOW_INSECURE") {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestMigrationConfigSkipsIdentityRuntimeDependencies(t *testing.T) {
	cfg := Config{
		Environment:                  "production",
		DatabaseURL:                  "postgres://identity",
		QRTransactionTTL:             time.Minute,
		EmailVerificationTTL:         time.Minute,
		EmailVerificationMaxAttempts: 5,
		EmailDelivery:                "log",
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("runtime identity config accepted missing production dependencies")
	}
	if err := cfg.validate(false); err != nil {
		t.Fatalf("migration identity config should only require the database: %v", err)
	}
}
