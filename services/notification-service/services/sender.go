package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net"
	"net/smtp"
	"sort"
	"strings"
	"sync"
	"time"

	"notification-service/config"
	"notification-service/models"
	"notification-service/store"
)

type NotificationRepository interface {
	CreateNotification(context.Context, *models.Notification) error
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
	mu           sync.RWMutex
	storage      map[string]*models.Notification
	repository   NotificationRepository
	workerActive bool
	workerWG     sync.WaitGroup
}

func NewNotificationService() *NotificationService {
	service, err := NewNotificationServiceWithContext(context.Background())
	if err != nil {
		// Kept for package-level callers and tests that used the original
		// constructor. The production binary uses the error-returning
		// constructor and never falls back after a database failure.
		log.Printf("notification repository unavailable, using memory store: %v", err)
		return newMemoryNotificationService(config.Load())
	}
	return service
}

func NewNotificationServiceWithContext(ctx context.Context) (*NotificationService, error) {
	cfg := config.Load()
	service := &NotificationService{
		cfg:     cfg,
		storage: make(map[string]*models.Notification),
	}
	if cfg.DatabaseURL == "" {
		if cfg.Environment != "production" {
			service.seedDemoInbox()
		}
		return service, nil
	}

	repository, err := store.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	service.repository = repository
	return service, nil
}

func newMemoryNotificationService(cfg *config.Config) *NotificationService {
	service := &NotificationService{
		cfg:     cfg,
		storage: make(map[string]*models.Notification),
	}
	if cfg.Environment != "production" {
		service.seedDemoInbox()
	}
	return service
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
	s.mu.Lock()
	if s.workerActive {
		s.mu.Unlock()
		return
	}
	s.workerActive = true
	s.workerWG.Add(1)
	s.mu.Unlock()
	go func() {
		defer s.workerWG.Done()
		s.deliveryLoop(ctx, repository)
	}()
}

func (s *NotificationService) Ping(ctx context.Context) error {
	if s.repository == nil {
		return nil
	}
	return s.repository.Ping(ctx)
}

func (s *NotificationService) CreateNotification(req *models.CreateNotificationRequest) (*models.Notification, error) {
	return s.CreateNotificationContext(context.Background(), req)
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

	if s.repository != nil {
		if err := s.repository.CreateNotification(ctx, notification); err != nil {
			return nil, err
		}
	} else {
		s.mu.Lock()
		s.storage[notification.ID] = notification
		s.mu.Unlock()
	}

	s.mu.RLock()
	workerActive := s.workerActive
	s.mu.RUnlock()
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
	if s.repository != nil {
		return s.repository.ListNotifications(ctx, userID, unreadOnly)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]*models.Notification, 0, len(s.storage))
	for _, n := range s.storage {
		if userID != "" && n.UserID != "" && n.UserID != userID {
			continue
		}
		if unreadOnly && n.Read {
			continue
		}
		// Only in-app inbox items for badge UX (still return email if listed without filter)
		out = append(out, n)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *NotificationService) MarkRead(id, userID string) (*models.Notification, error) {
	return s.MarkReadContext(context.Background(), id, userID)
}

func (s *NotificationService) MarkReadContext(ctx context.Context, id, userID string) (*models.Notification, error) {
	if s.repository != nil {
		notification, err := s.repository.MarkRead(ctx, id, userID)
		if errors.Is(err, store.ErrNotFound) {
			return nil, errNotFound
		}
		return notification, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.storage[id]
	if !ok {
		return nil, errNotFound
	}
	if n.UserID != "" && n.UserID != userID {
		return nil, errNotFound
	}
	n.Read = true
	return n, nil
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
	if s.repository != nil {
		return s.repository.MarkAllRead(ctx, userID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, item := range s.storage {
		if userID != "" && item.UserID != "" && item.UserID != userID {
			continue
		}
		if !item.Read {
			item.Read = true
			n++
		}
	}
	return n, nil
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
	s.mu.Lock()
	defer s.mu.Unlock()
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

func (s *NotificationService) seedDemoInbox() {
	// Deterministic seed so mobile can hit real API without manual create.
	now := time.Now()
	items := []*models.Notification{
		{ID: "seed-home-1", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "项目 A 有新评论", Content: "设计评审已更新", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-2 * time.Hour)},
		{ID: "seed-home-2", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "任务指派", Content: "你被加入 Sprint 12", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-90 * time.Minute)},
		{ID: "seed-home-3", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "构建成功", Content: "dev 分支 CI 通过", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-60 * time.Minute)},
		{ID: "seed-home-4", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "文档更新", Content: "README 已同步", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-45 * time.Minute)},
		{ID: "seed-home-5", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "Mention", Content: "@你 在讨论中被提及", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-40 * time.Minute)},
		{ID: "seed-home-6", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "日程提醒", Content: "15:00 站会", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-30 * time.Minute)},
		{ID: "seed-home-7", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "代码评审", Content: "PR #128 待你 review", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-25 * time.Minute)},
		{ID: "seed-home-8", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "依赖升级", Content: "Compose BOM 可更新", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-20 * time.Minute)},
		{ID: "seed-home-9", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "权限申请", Content: "新成员请求加入", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-15 * time.Minute)},
		{ID: "seed-home-10", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "部署完成", Content: "staging 已发布", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-12 * time.Minute)},
		{ID: "seed-home-11", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "告警恢复", Content: "API 延迟已恢复", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-10 * time.Minute)},
		{ID: "seed-home-12", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "周报待填", Content: "请于周五前提交", Category: models.TabHome, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-5 * time.Minute)},
		{ID: "seed-ws-1", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "工作区有新文件", Content: "design.fig 已上传", Category: models.TabWorkspace, DotOnly: true, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-8 * time.Minute)},
		{ID: "seed-me-1", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "安全提醒", Content: "新设备登录", Category: models.TabMe, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-3 * time.Hour)},
		{ID: "seed-me-2", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "系统公告", Content: "维护窗口本周日", Category: models.TabMe, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-2 * time.Hour)},
		{ID: "seed-me-3", Type: models.NotificationTypeInApp, UserID: "demo", Recipient: "demo@workbench.local", Subject: "账号绑定", Content: "可绑定手机号", Category: models.TabMe, Read: false, Status: models.NotificationStatusSent, CreatedAt: now.Add(-1 * time.Hour)},
	}
	for _, n := range items {
		s.storage[n.ID] = n
	}
	log.Printf("Seeded %d demo inbox notifications for user=demo", len(items))
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
