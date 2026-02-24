package models

import "time"

type NotificationType string

const (
	NotificationTypeEmail NotificationType = "email"
	NotificationTypeInApp NotificationType = "in_app"
)

type NotificationStatus string

const (
	NotificationStatusPending  NotificationStatus = "pending"
	NotificationStatusSent     NotificationStatus = "sent"
	NotificationStatusFailed   NotificationStatus = "failed"
)

type Notification struct {
	ID         string             `json:"id" bson:"_id"`
	Type       NotificationType   `json:"type" bson:"type"`
	Recipient  string             `json:"recipient" bson:"recipient"`
	Subject    string             `json:"subject" bson:"subject"`
	Content    string             `json:"content" bson:"content"`
	Status     NotificationStatus `json:"status" bson:"status"`
	CreatedAt  time.Time          `json:"created_at" bson:"created_at"`
	SentAt     *time.Time         `json:"sent_at,omitempty" bson:"sent_at,omitempty"`
}

type CreateNotificationRequest struct {
	Type      NotificationType `json:"type" binding:"required"`
	Recipient string           `json:"recipient" binding:"required"`
	Subject   string           `json:"subject" binding:"required"`
	Content   string           `json:"content" binding:"required"`
}
