package services

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
	"notification-service/config"
	"notification-service/models"
	"notification-service/store"
)

type fakeNotificationRepository struct {
	mu            sync.Mutex
	notifications map[string]*models.Notification
	events        map[string]struct{}
}

func newFakeNotificationRepository() *fakeNotificationRepository {
	return &fakeNotificationRepository{
		notifications: make(map[string]*models.Notification),
		events:        make(map[string]struct{}),
	}
}

func (r *fakeNotificationRepository) CreateNotification(_ context.Context, notification *models.Notification) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifications[notification.ID] = notification
	return nil
}

func (r *fakeNotificationRepository) ConsumeEvent(_ context.Context, event *models.OutboxEvent, notification *models.Notification) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.events[event.ID]; exists {
		return false, nil
	}
	r.events[event.ID] = struct{}{}
	if notification != nil {
		r.notifications[notification.ID] = notification
	}
	return true, nil
}

func (r *fakeNotificationRepository) ListNotifications(_ context.Context, userID string, unreadOnly bool) ([]*models.Notification, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	result := make([]*models.Notification, 0, len(r.notifications))
	for _, notification := range r.notifications {
		if userID != "" && notification.UserID != "" && notification.UserID != userID {
			continue
		}
		if unreadOnly && notification.Read {
			continue
		}
		result = append(result, notification)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	return result, nil
}

func (r *fakeNotificationRepository) MarkRead(_ context.Context, id, userID string) (*models.Notification, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	notification, exists := r.notifications[id]
	if !exists || (notification.UserID != "" && notification.UserID != userID) {
		return nil, store.ErrNotFound
	}
	notification.Read = true
	return notification, nil
}

func (r *fakeNotificationRepository) MarkAllRead(_ context.Context, userID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	marked := 0
	for _, notification := range r.notifications {
		if userID != "" && notification.UserID != "" && notification.UserID != userID {
			continue
		}
		if !notification.Read {
			notification.Read = true
			marked++
		}
	}
	return marked, nil
}

func (r *fakeNotificationRepository) UpdateDelivery(_ context.Context, id string, status models.NotificationStatus, sentAt *time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	notification, exists := r.notifications[id]
	if !exists {
		return store.ErrNotFound
	}
	notification.Status = status
	notification.SentAt = sentAt
	return nil
}

func (r *fakeNotificationRepository) Ping(context.Context) error { return nil }

func (r *fakeNotificationRepository) Close() {}

func TestNewNotificationServiceRejectsMissingDatabase(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("NOTIFICATION_DATABASE_URL", "")

	service, err := NewNotificationServiceWithContext(context.Background())
	if err == nil {
		t.Fatal("expected missing notification database to prevent service startup")
	}
	if service != nil {
		t.Fatal("service must not fall back to an in-memory inbox")
	}
}

func TestNewKafkaEventConsumerIsDisabledWithoutBrokers(t *testing.T) {
	consumer, err := NewKafkaEventConsumer(&config.Config{}, &NotificationService{})
	if err != nil {
		t.Fatalf("creating disabled Kafka consumer: %v", err)
	}
	if consumer != nil {
		t.Fatal("Kafka consumer was created without brokers")
	}
}

func TestDecodeKafkaEventUsesMessageKeyWhenIDIsOmitted(t *testing.T) {
	event, err := decodeKafkaEvent(kafka.Message{
		Key:   []byte("event-key"),
		Value: []byte(`{"tenantId":"tenant-1","topic":"task.created","payload":{}}`),
	})
	if err != nil {
		t.Fatalf("decode Kafka event: %v", err)
	}
	if event.ID != "event-key" || event.Topic != "task.created" {
		t.Fatalf("decoded event = %#v", event)
	}
}

func TestMarkReadCannotCrossUserBoundary(t *testing.T) {
	repository := newFakeNotificationRepository()
	service := &NotificationService{
		cfg:        &config.Config{},
		repository: repository,
	}
	notification := &models.Notification{ID: "n-1", UserID: "alice"}
	repository.notifications[notification.ID] = notification

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
	repository := newFakeNotificationRepository()
	service := &NotificationService{
		cfg:        &config.Config{},
		repository: repository,
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
	if len(repository.notifications) != 1 {
		t.Fatalf("notifications = %d, want one", len(repository.notifications))
	}
}

func TestConsumeDictionaryEventCreatesWorkspaceNotification(t *testing.T) {
	repository := newFakeNotificationRepository()
	service := &NotificationService{
		cfg:        &config.Config{},
		repository: repository,
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
	if len(repository.notifications) != 1 {
		t.Fatalf("notifications = %d, want one", len(repository.notifications))
	}
	for _, notification := range repository.notifications {
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
