package main

import (
	"context"
	"log"

	"github.com/axi-workbench/identity-adapter/internal/config"
	"github.com/axi-workbench/identity-adapter/internal/store"
)

func main() {
	cfg, err := config.LoadForMigration()
	if err != nil {
		log.Fatalf("identity migration configuration: %v", err)
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("IDENTITY_DATABASE_URL is required for identity migration")
	}
	persistence, err := store.NewPostgres(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("identity migration connection: %v", err)
	}
	defer persistence.Close()
	if err := persistence.ApplyMigrations(context.Background()); err != nil {
		log.Fatalf("identity migration: %v", err)
	}
}
