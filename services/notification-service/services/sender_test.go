package services

import (
	"testing"

	"notification-service/config"
	"notification-service/models"
)

func TestMarkReadCannotCrossUserBoundary(t *testing.T) {
	service := &NotificationService{
		cfg:     &config.Config{},
		storage: make(map[string]*models.Notification),
	}
	notification := &models.Notification{ID: "n-1", UserID: "alice"}
	service.storage[notification.ID] = notification

	if _, err := service.MarkRead(notification.ID, "bob"); err == nil {
		t.Fatal("cross-user mark read unexpectedly succeeded")
	}
	if _, err := service.MarkRead(notification.ID, "alice"); err != nil {
		t.Fatalf("owner mark read failed: %v", err)
	}
	if !notification.Read {
		t.Fatal("owner mark read did not update notification")
	}
}
