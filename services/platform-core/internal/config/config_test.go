package config

import (
	"testing"
	"time"
)

func TestMigrationConfigDoesNotRequireRuntimeOutboxDelivery(t *testing.T) {
	cfg := Config{OutboxWorkerEnabled: true, OutboxPollInterval: time.Second}
	if err := cfg.Validate(); err == nil {
		t.Fatal("runtime config accepted an enabled outbox worker without a delivery URL")
	}
	if err := cfg.validate(false); err != nil {
		t.Fatalf("migration config should ignore runtime outbox delivery: %v", err)
	}
}
