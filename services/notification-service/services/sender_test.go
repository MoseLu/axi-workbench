package services

import (
	"encoding/json"
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

func TestConsumeEventIsIdempotentAndCreatesTargetedNotification(t *testing.T) {
	service := &NotificationService{
		cfg:        &config.Config{},
		storage:    make(map[string]*models.Notification),
		eventInbox: make(map[string]struct{}),
	}
	event := &models.OutboxEvent{
		ID:      "event-1",
		Topic:   "task.created",
		Payload: json.RawMessage(`{"createdBy":"alice","title":"Ship API"}`),
	}
	accepted, err := service.ConsumeEvent(event)
	if err != nil || !accepted {
		t.Fatalf("first event = accepted %v, err %v", accepted, err)
	}
	accepted, err = service.ConsumeEvent(event)
	if err != nil || accepted {
		t.Fatalf("duplicate event = accepted %v, err %v", accepted, err)
	}
	if len(service.storage) != 1 {
		t.Fatalf("notifications = %d, want one", len(service.storage))
	}
}

func TestConsumeDictionaryEventCreatesWorkspaceNotification(t *testing.T) {
	service := &NotificationService{
		cfg:        &config.Config{},
		storage:    make(map[string]*models.Notification),
		eventInbox: make(map[string]struct{}),
	}
	event := &models.OutboxEvent{
		ID:      "dictionary-event-1",
		Topic:   "dictionary.changed",
		Payload: json.RawMessage(`{"changedBy":"alice","key":"statuses","version":2}`),
	}

	accepted, err := service.ConsumeEvent(event)
	if err != nil || !accepted {
		t.Fatalf("dictionary event = accepted %v, err %v", accepted, err)
	}
	if len(service.storage) != 1 {
		t.Fatalf("notifications = %d, want one", len(service.storage))
	}
	for _, notification := range service.storage {
		if notification.UserID != "alice" || notification.Category != models.TabWorkspace {
			t.Fatalf("notification target = %#v", notification)
		}
		if notification.Content != "字典 statuses 已更新至第 2 版" {
			t.Fatalf("notification content = %q", notification.Content)
		}
	}
}

func TestNotificationTemplatesCoverSpecialistEvents(t *testing.T) {
	tests := []struct {
		topic    string
		payload  string
		subject  string
		category models.TabCategory
		dotOnly  bool
	}{
		{topic: "workflow.completed", payload: `{"subject":"alice","workflowId":"wf-1"}`, subject: "工作流已完成", category: models.TabWorkspace},
		{topic: "workflow.failed", payload: `{"subject":"alice","workflowName":"发布流程"}`, subject: "工作流执行失败", category: models.TabWorkspace},
		{topic: "file.uploaded", payload: `{"subject":"alice","fileName":"report.pdf"}`, subject: "文件已上传", category: models.TabWorkspace},
		{topic: "file.scan.rejected", payload: `{"subject":"alice","name":"payload.bin"}`, subject: "文件未通过安全扫描", category: models.TabWorkspace, dotOnly: true},
		{topic: "security.login", payload: `{"subject":"alice","client":"mobile"}`, subject: "安全提醒", category: models.TabMe},
	}

	for _, test := range tests {
		t.Run(test.topic, func(t *testing.T) {
			event := &models.OutboxEvent{ID: "event-" + test.topic, Topic: test.topic, Payload: json.RawMessage(test.payload)}
			notification := notificationForEvent(event)
			if notification == nil {
				t.Fatal("event did not produce a notification")
			}
			if notification.Subject != test.subject || notification.Category != test.category || notification.DotOnly != test.dotOnly {
				t.Fatalf("notification metadata = %#v", notification)
			}
			if notification.Content == "" {
				t.Fatal("notification content is empty")
			}
		})
	}
}
