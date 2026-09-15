package main

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/axi-workbench/platform-core/internal/config"
	"github.com/axi-workbench/platform-core/internal/store"
)

func main() {
	cfg, err := config.LoadForMigration()
	if err != nil {
		log.Fatalf("platform migration configuration: %v", err)
	}
	migrationURL := strings.TrimSpace(os.Getenv("PLATFORM_MIGRATION_DATABASE_URL"))
	if migrationURL == "" {
		migrationURL = cfg.DatabaseURL
	}
	if migrationURL == "" {
		log.Fatal("PLATFORM_MIGRATION_DATABASE_URL (or PLATFORM_DATABASE_URL for local development) is required for platform migration")
	}
	persistence, err := store.NewPostgres(context.Background(), migrationURL)
	if err != nil {
		log.Fatalf("platform migration connection: %v", err)
	}
	defer persistence.Close()
	if err := persistence.ApplyMigrations(context.Background()); err != nil {
		log.Fatalf("platform migration: %v", err)
	}
}
