package services

import (
	"log"
	"time"

	"notification-service/config"
	"notification-service/models"
)

type NotificationService struct {
	cfg     *config.Config
	storage map[string]*models.Notification
}

func NewNotificationService() *NotificationService {
	return &NotificationService{
		cfg:     config.Load(),
		storage: make(map[string]*models.Notification),
	}
}

func (s *NotificationService) CreateNotification(req *models.CreateNotificationRequest) (*models.Notification, error) {
	notification := &models.Notification{
		ID:        generateID(),
		Type:      req.Type,
		Recipient: req.Recipient,
		Subject:  req.Subject,
		Content:   req.Content,
		Status:    models.NotificationStatusPending,
		CreatedAt: time.Now(),
	}

	// Store the notification
	s.storage[notification.ID] = notification

	// Send the notification asynchronously
	go s.sendNotification(notification)

	return notification, nil
}

func (s *NotificationService) ListNotifications() []*models.Notification {
	notifications := make([]*models.Notification, 0, len(s.storage))
	for _, n := range s.storage {
		notifications = append(notifications, n)
	}
	return notifications
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
	// In production, this would use SMTP or an email service API
	log.Printf("[EMAIL] To: %s, Subject: %s, Content: %s", n.Recipient, n.Subject, n.Content)
	
	// Simulate sending delay
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (s *NotificationService) sendInApp(n *models.Notification) error {
	// In production, this would store in database and push via WebSocket
	log.Printf("[IN-APP] To: %s, Subject: %s, Content: %s", n.Recipient, n.Subject, n.Content)
	
	// Simulate processing delay
	time.Sleep(50 * time.Millisecond)
	
	return nil
}

func generateID() string {
	return time.Now().Format("20060102150405.000000")
}
