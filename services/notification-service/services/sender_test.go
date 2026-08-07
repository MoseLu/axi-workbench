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

func TestSendEmailRejectsHeaderInjection(t *testing.T) {
	service := &NotificationService{
		cfg: &config.Config{
			SMTPHost:  "127.0.0.1",
			SMTPPort:  "1",
			FromEmail: "noreply@example.com",
		},
	}

	err := service.sendEmail(&models.Notification{
		Recipient: "alice@example.com\r\nBcc: attacker@example.com",
		Subject:   "subject",
		Content:   "body",
	})
	if err == nil {
		t.Fatal("header injection was accepted")
	}
}
