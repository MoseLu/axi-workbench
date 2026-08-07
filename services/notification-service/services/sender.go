package services

import (
	"log"
	"sort"
	"sync"
	"time"

	"notification-service/config"
	"notification-service/models"
)

type NotificationService struct {
	cfg     *config.Config
	mu      sync.RWMutex
	storage map[string]*models.Notification
}

func NewNotificationService() *NotificationService {
	s := &NotificationService{
		cfg:     config.Load(),
		storage: make(map[string]*models.Notification),
	}
	s.seedDemoInbox()
	return s
}

func (s *NotificationService) CreateNotification(req *models.CreateNotificationRequest) (*models.Notification, error) {
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

	s.mu.Lock()
	s.storage[notification.ID] = notification
	s.mu.Unlock()

	go s.sendNotification(notification)
	return notification, nil
}

func (s *NotificationService) ListNotifications(userID string, unreadOnly bool) []*models.Notification {
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
	return out
}

func (s *NotificationService) MarkRead(id string) (*models.Notification, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.storage[id]
	if !ok {
		return nil, errNotFound
	}
	n.Read = true
	return n, nil
}

func (s *NotificationService) MarkAllRead(userID string) int {
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
	return n
}

// GetNavBadges aggregates unread in-app items into bottom-tab badges (WeChat-style).
// - home / projects / me → numeric count
// - workspace → red dot when any unread (发现-style)
func (s *NotificationService) GetNavBadges(userID string) *models.NavBadgesResponse {
	list := s.ListNotifications(userID, true)
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
	}
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
	var err error
	switch n.Type {
	case models.NotificationTypeEmail:
		err = s.sendEmail(n)
	case models.NotificationTypeInApp:
		err = s.sendInApp(n)
	default:
		err = s.sendInApp(n)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		log.Printf("Failed to send notification %s: %v", n.ID, err)
		n.Status = models.NotificationStatusFailed
	} else {
		n.Status = models.NotificationStatusSent
		now := time.Now()
		n.SentAt = &now
	}
}

func (s *NotificationService) sendEmail(n *models.Notification) error {
	log.Printf("[EMAIL] To: %s, Subject: %s", n.Recipient, n.Subject)
	time.Sleep(50 * time.Millisecond)
	return nil
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
	return time.Now().Format("20060102150405.000000")
}

var errNotFound = errString("notification not found")

type errString string

func (e errString) Error() string { return string(e) }
