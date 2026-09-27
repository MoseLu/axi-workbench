package models

import "time"

type NotificationType string

const (
	NotificationTypeEmail NotificationType = "email"
	NotificationTypeInApp NotificationType = "in_app"
)

// TabCategory maps an in-app item to a bottom-nav tab badge.
type TabCategory string

const (
	TabHome      TabCategory = "home"
	TabProjects  TabCategory = "projects"
	TabWorkspace TabCategory = "workspace"
	TabMe        TabCategory = "me"
)

type NotificationStatus string

const (
	NotificationStatusPending NotificationStatus = "pending"
	NotificationStatusSent    NotificationStatus = "sent"
	NotificationStatusFailed  NotificationStatus = "failed"
)

// BadgeKind: none | dot | count — aligns with mobile NavBadge.
type BadgeKind string

const (
	BadgeNone  BadgeKind = "none"
	BadgeDot   BadgeKind = "dot"
	BadgeCount BadgeKind = "count"
)

type Notification struct {
	ID        string             `json:"id"`
	Type      NotificationType   `json:"type"`
	// UserID scopes inbox; empty = broadcast (listed for all, counted once per client).
	UserID    string             `json:"userId"`
	Recipient string             `json:"recipient"`
	Subject   string             `json:"subject"`
	Content   string             `json:"content"`
	// Category drives which bottom-tab badge increments.
	Category  TabCategory        `json:"category"`
	// DotOnly: if true and unread, tab shows red dot instead of a number (WeChat「发现」).
	DotOnly   bool               `json:"dotOnly"`
	Read      bool               `json:"read"`
	Status    NotificationStatus `json:"status"`
	CreatedAt time.Time          `json:"createdAt"`
	SentAt    *time.Time         `json:"sentAt,omitempty"`
}

type CreateNotificationRequest struct {
	Type      NotificationType `json:"type" binding:"required"`
	UserID    string           `json:"userId"`
	Recipient string           `json:"recipient" binding:"required"`
	Subject   string           `json:"subject" binding:"required"`
	Content   string           `json:"content" binding:"required"`
	Category  TabCategory      `json:"category"`
	DotOnly   bool             `json:"dotOnly"`
}

// NavBadgeDTO is one tab's badge for the mobile chrome.
type NavBadgeDTO struct {
	Kind  BadgeKind `json:"kind"`
	Value int       `json:"value,omitempty"`
}

// NavBadgesResponse is GET /notifications/nav-badges payload.
type NavBadgesResponse struct {
	Home      NavBadgeDTO `json:"home"`
	Projects  NavBadgeDTO `json:"projects"`
	Workspace NavBadgeDTO `json:"workspace"`
	Me        NavBadgeDTO `json:"me"`
	// UnreadTotal is all unread in-app items for the user.
	UnreadTotal int `json:"unreadTotal"`
}
