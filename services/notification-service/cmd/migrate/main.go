package main

import (
	"context"
	"log"
	"time"

	"notification-service/config"
	"notification-service/store"
)

func main() {
	cfg := config.Load()
	if cfg.MigrationDatabaseURL == "" {
		log.Fatal("NOTIFICATION_MIGRATION_DATABASE_URL or NOTIFICATION_DATABASE_URL must be set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	repository, err := store.NewPostgres(ctx, cfg.MigrationDatabaseURL)
	if err != nil {
		log.Fatalf("connect notification database: %v", err)
	}
	defer repository.Close()
	if err := repository.ApplyMigrations(ctx); err != nil {
		log.Fatalf("apply notification migrations: %v", err)
	}
	log.Printf("notification migrations applied")
}
