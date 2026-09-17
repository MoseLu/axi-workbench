package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"sync"
	"time"

	"notification-service/config"
	"notification-service/models"
	"notification-service/store"
)

type NotificationRepository interface {
	CreateNotification(context.Context, *models.Notification) error
	ConsumeEvent(context.Context, *models.OutboxEvent, *models.Notification) (bool, error)
	ListNotifications(context.Context, string, bool) ([]*models.Notification, error)
	MarkRead(context.Context, string, string) (*models.Notification, error)
	MarkAllRead(context.Context, string) (int, error)
	UpdateDelivery(context.Context, string, models.NotificationStatus, *time.Time) error
	Ping(context.Context) error
	Close()
}

type DeliveryRepository interface {
	NotificationRepository
	ClaimPending(context.Context, int) ([]*models.Notification, error)
	ReleaseDelivery(context.Context, string, models.NotificationStatus, *time.Time, error) error
}

type NotificationService struct {
	cfg          *config.Config
	repository   NotificationRepository
	workerMu     sync.Mutex
	workerActive bool
	workerWG     sync.WaitGroup
}

func NewNotificationService() *NotificationService {
	service, err := NewNotificationServiceWithContext(context.Background())
	if err != nil {
		// Keep the legacy constructor signature while surfacing the mandatory
		// repository configuration failure to its caller.
		panic(err)
	}
	return service
}

func NewNotificationServiceWithContext(ctx context.Context) (*NotificationService, error) {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		return nil, errors.New("NOTIFICATION_DATABASE_URL is required for notification-service")
	}

	service := &NotificationService{
		cfg: cfg,
	}

	repository, err := store.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	service.repository = repository
	return service, nil
}

func (s *NotificationService) Close() {
	s.workerWG.Wait()
	if s.repository != nil {
		s.repository.Close()
	}
}

// StartDeliveryWorker resumes pending PostgreSQL deliveries after a restart.
// Kafka remains an external event-ingestion option; this local outbox worker
// is the durable first-stage delivery contract required by the API plane.
func (s *NotificationService) StartDeliveryWorker(ctx context.Context) {
	repository, ok := s.repository.(DeliveryRepository)
	if !ok {
		return
	}
	s.workerMu.Lock()
	if s.workerActive {
		s.workerMu.Unlock()
		return
	}
	s.workerActive = true
	s.workerWG.Add(1)
	s.workerMu.Unlock()
	go func() {
		defer s.workerWG.Done()
		s.deliveryLoop(ctx, repository)
	}()
}

func (s *NotificationService) Ping(ctx context.Context) error {
	if s.repository == nil {
		return errors.New("notification repository is not initialized")
	}
	return s.repository.Ping(ctx)
}

func (s *NotificationService) CreateNotification(req *models.CreateNotificationRequest) (*models.Notification, error) {
	return s.CreateNotificationContext(context.Background(), req)
}

// ConsumeEvent persists the event ID before any notification side effect.
// Unknown or non-user-targeted topics are still acknowledged and retained in
// the inbox; adding a new notification mapping therefore cannot make the
// platform outbox redeliver old events forever.
func (s *NotificationService) ConsumeEvent(event *models.OutboxEvent) (bool, error) {
	return s.ConsumeEventContext(context.Background(), event)
}

func (s *NotificationService) ConsumeEventContext(ctx context.Context, event *models.OutboxEvent) (bool, error) {
	if event == nil || event.ID == "" {
		return false, errors.New("event id is required")
	}
	if s.repository == nil {
		return false, errors.New("notification repository is not initialized")
	}
	notification := notificationForEvent(event)
	return s.repository.ConsumeEvent(ctx, event, notification)
}

func (s *NotificationService) CreateNotificationContext(ctx context.Context, req *models.CreateNotificationRequest) (*models.Notification, error) {
	cat := req.Category
	if cat == "" {
		cat = models.TabMe
	}
	notification := &models.Notification{
		ID:        generateID(),
		Type:      req.Type,
		UserID:    req.UserID,
		Recipient: req.Recipient,
		Subject:   req.Subject,
		Content:   req.Content,
		Category:  cat,
		DotOnly:   req.DotOnly,
		Read:      false,
		Status:    models.NotificationStatusPending,
		CreatedAt: time.Now(),
	}

	if s.repository == nil {
		return nil, errors.New("notification repository is not initialized")
	}
	if err := s.repository.CreateNotification(ctx, notification); err != nil {
		return nil, err
	}

	s.workerMu.Lock()
	workerActive := s.workerActive
	s.workerMu.Unlock()
	if !workerActive {
		go s.sendNotification(notification)
	}
	return notification, nil
}

func (s *NotificationService) ListNotifications(userID string, unreadOnly bool) []*models.Notification {
	result, err := s.ListNotificationsContext(context.Background(), userID, unreadOnly)
	if err != nil {
		log.Printf("list notifications failed: %v", err)
		return nil
	}
	return result
}

func (s *NotificationService) ListNotificationsContext(ctx context.Context, userID string, unreadOnly bool) ([]*models.Notification, error) {
	if s.repository == nil {
		return nil, errors.New("notification repository is not initialized")
	}
	return s.repository.ListNotifications(ctx, userID, unreadOnly)
}

func (s *NotificationService) MarkRead(id, userID string) (*models.Notification, error) {
	return s.MarkReadContext(context.Background(), id, userID)
}

func (s *NotificationService) MarkReadContext(ctx context.Context, id, userID string) (*models.Notification, error) {
	if s.repository == nil {
		return nil, errors.New("notification repository is not initialized")
	}
	notification, err := s.repository.MarkRead(ctx, id, userID)
	if errors.Is(err, store.ErrNotFound) {
		return nil, errNotFound
	}
	return notification, err
}

func (s *NotificationService) MarkAllRead(userID string) int {
	count, err := s.MarkAllReadContext(context.Background(), userID)
	if err != nil {
		log.Printf("mark all notifications read failed: %v", err)
		return 0
	}
	return count
}

func (s *NotificationService) MarkAllReadContext(ctx context.Context, userID string) (int, error) {
	if s.repository == nil {
		return 0, errors.New("notification repository is not initialized")
	}
	return s.repository.MarkAllRead(ctx, userID)
}

// GetNavBadges aggregates unread in-app items into bottom-tab badges (WeChat-style).
// - home / projects / me → numeric count
// - workspace → red dot when any unread (发现-style)
func (s *NotificationService) GetNavBadges(userID string) *models.NavBadgesResponse {
	result, err := s.GetNavBadgesContext(context.Background(), userID)
	if err != nil {
		log.Printf("get notification badges failed: %v", err)
		return nil
	}
	return result
}

func (s *NotificationService) GetNavBadgesContext(ctx context.Context, userID string) (*models.NavBadgesResponse, error) {
	list, err := s.ListNotificationsContext(ctx, userID, true)
	if err != nil {
		return nil, err
	}
	counts := map[models.TabCategory]int{}
	total := 0

	for _, n := range list {
		if n.Type != models.NotificationTypeInApp && n.Type != "" {
			continue
		}
		if n.Read {
			continue
		}
		total++
		cat := n.Category
		if cat == "" {
			cat = models.TabMe
		}
		counts[cat]++
	}

	return &models.NavBadgesResponse{
		Home:        toBadge(counts[models.TabHome], false),
		Projects:    toBadge(counts[models.TabProjects], false),
		Workspace:   toBadge(counts[models.TabWorkspace], true),
		Me:          toBadge(counts[models.TabMe], false),
		UnreadTotal: total,
	}, nil
}

func toBadge(count int, forceDot bool) models.NavBadgeDTO {
	if count <= 0 {
		return models.NavBadgeDTO{Kind: models.BadgeNone}
	}
	if forceDot {
		return models.NavBadgeDTO{Kind: models.BadgeDot}
	}
	return models.NavBadgeDTO{Kind: models.BadgeCount, Value: count}
}

func (s *NotificationService) sendNotification(n *models.Notification) {
	status, sentAt, deliveryErr := s.deliverNotification(n)
	s.applyDelivery(n, status, sentAt)
	if deliveryRepository, ok := s.repository.(DeliveryRepository); ok {
		if updateErr := deliveryRepository.ReleaseDelivery(context.Background(), n.ID, status, sentAt, deliveryErr); updateErr != nil {
			log.Printf("persist notification delivery job %s: %v", n.ID, updateErr)
		}
	} else if s.repository != nil {
		if updateErr := s.repository.UpdateDelivery(context.Background(), n.ID, status, sentAt); updateErr != nil {
			log.Printf("persist notification delivery status %s: %v", n.ID, updateErr)
		}
	}
}

func (s *NotificationService) deliverNotification(n *models.Notification) (models.NotificationStatus, *time.Time, error) {
	var err error
	switch n.Type {
	case models.NotificationTypeEmail:
		err = s.sendEmail(n)
	case models.NotificationTypeInApp:
		err = s.sendInApp(n)
	default:
		err = s.sendInApp(n)
	}
	status := models.NotificationStatusSent
	var sentAt *time.Time
	if err != nil {
		log.Printf("Failed to send notification %s: %v", n.ID, err)
		status = models.NotificationStatusFailed
	} else {
		now := time.Now()
		sentAt = &now
	}

	return status, sentAt, err
}

func (s *NotificationService) applyDelivery(n *models.Notification, status models.NotificationStatus, sentAt *time.Time) {
	n.Status = status
	n.SentAt = sentAt
}

func (s *NotificationService) sendEmail(n *models.Notification) error {
	if strings.ContainsAny(n.Recipient, "\r\n") || strings.ContainsAny(n.Subject, "\r\n") {
		return errors.New("email recipient and subject cannot contain CRLF")
	}
	address := net.JoinHostPort(s.cfg.SMTPHost, s.cfg.SMTPPort)
	var auth smtp.Auth
	if s.cfg.SMTPUsername != "" || s.cfg.SMTPPassword != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}
	message := strings.Join([]string{
		"From: " + s.cfg.FromEmail,
		"To: " + n.Recipient,
		"Subject: " + n.Subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		n.Content,
	}, "\r\n")
	return smtp.SendMail(address, auth, s.cfg.FromEmail, []string{n.Recipient}, []byte(message))
}

func (s *NotificationService) sendInApp(n *models.Notification) error {
	log.Printf("[IN-APP] user=%s cat=%s subject=%s", n.UserID, n.Category, n.Subject)
	time.Sleep(20 * time.Millisecond)
	return nil
}

func notificationForEvent(event *models.OutboxEvent) *models.Notification {
	var payload map[string]json.RawMessage
	if len(event.Payload) == 0 || json.Unmarshal(event.Payload, &payload) != nil {
		return nil
	}

	recipient := eventPayloadString(payload, "subject")
	if recipient == "" {
		recipient = eventPayloadString(payload, "createdBy")
	}
	if recipient == "" {
		recipient = eventPayloadString(payload, "changedBy")
	}
	if recipient == "" {
		return nil
	}

	template, ok := notificationTemplateForEvent(event.Topic)
	if !ok {
		return nil
	}

	now := time.Now().UTC()
	return &models.Notification{
		ID:        generateID(),
		Type:      models.NotificationTypeInApp,
		UserID:    recipient,
		Recipient: recipient,
		Subject:   template.subject,
		Content:   template.content(payload),
		Category:  template.category,
		DotOnly:   template.dotOnly,
		Status:    models.NotificationStatusPending,
		CreatedAt: now,
	}
}

func eventPayloadString(payload map[string]json.RawMessage, key string) string {
	var value string
	if raw, ok := payload[key]; ok && json.Unmarshal(raw, &value) == nil {
		return strings.TrimSpace(value)
	}
	var number int64
	if raw, ok := payload[key]; ok && json.Unmarshal(raw, &number) == nil {
		return strconv.FormatInt(number, 10)
	}
	return ""
}

func generateID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err == nil {
		return hex.EncodeToString(raw[:])
	}
	return time.Now().UTC().Format("20060102150405.000000000")
}

func (s *NotificationService) deliveryLoop(ctx context.Context, repository DeliveryRepository) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		if err := s.deliverPending(ctx, repository); err != nil && !errors.Is(err, context.Canceled) {
			log.Printf("notification delivery worker failed: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *NotificationService) deliverPending(ctx context.Context, repository DeliveryRepository) error {
	notifications, err := repository.ClaimPending(ctx, 16)
	if err != nil {
		return err
	}
	for _, notification := range notifications {
		status, sentAt, deliveryErr := s.deliverNotification(notification)
		s.applyDelivery(notification, status, sentAt)
		if err := repository.ReleaseDelivery(ctx, notification.ID, status, sentAt, deliveryErr); err != nil {
			log.Printf("persist notification delivery result %s: %v", notification.ID, err)
		}
	}
	return nil
}

var errNotFound = errString("notification not found")

type errString string

func (e errString) Error() string { return string(e) }
