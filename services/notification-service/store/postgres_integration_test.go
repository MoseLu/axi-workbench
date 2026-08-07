package store

import (
	"context"
	"os"
	"testing"
	"time"

	"notification-service/models"
)

func TestPostgresNotificationDeliveryLifecycle(t *testing.T) {
	databaseURL := os.Getenv("NOTIFICATION_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("NOTIFICATION_TEST_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	repository, err := NewPostgres(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer repository.Close()
	if err := repository.ApplyMigrations(ctx); err != nil {
		t.Fatal(err)
	}

	notification := &models.Notification{
		ID:        "integration-" + time.Now().UTC().Format("20060102150405.000000000"),
		Type:      models.NotificationTypeInApp,
		UserID:    "alice",
		Recipient: "alice@example.com",
		Subject:   "integration",
		Content:   "delivery",
		Category:  models.TabHome,
		Status:    models.NotificationStatusPending,
		CreatedAt: time.Now().UTC(),
	}
	if err := repository.CreateNotification(ctx, notification); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.MarkRead(ctx, notification.ID, "bob"); err != ErrNotFound {
		t.Fatalf("cross-user mark read error = %v, want ErrNotFound", err)
	}
	claimed, err := repository.ClaimPending(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(claimed) != 1 || claimed[0].ID != notification.ID {
		t.Fatalf("claimed = %#v, want notification %s", claimed, notification.ID)
	}
	if err := repository.ReleaseDelivery(ctx, notification.ID, models.NotificationStatusSent, ptrTime(time.Now().UTC()), nil); err != nil {
		t.Fatal(err)
	}
	claimed, err = repository.ClaimPending(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(claimed) != 0 {
		t.Fatalf("delivered notification was claimed again: %#v", claimed)
	}
}

func ptrTime(value time.Time) *time.Time { return &value }
