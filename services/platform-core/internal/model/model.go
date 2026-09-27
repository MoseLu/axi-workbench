package model

import (
	"encoding/json"
	"time"
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

func (r Role) Valid() bool {
	return r == RoleOwner || r == RoleAdmin || r == RoleEditor || r == RoleViewer
}

type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
}

type Membership struct {
	TenantID  string    `json:"tenantId"`
	Subject   string    `json:"subject"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Preferences struct {
	Subject            string    `json:"-"`
	Locale             string    `json:"locale"`
	Theme              string    `json:"theme"`
	Timezone           string    `json:"timezone"`
	NotificationsMuted bool      `json:"notificationsMuted"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type Dictionary struct {
	TenantID  string          `json:"tenantId"`
	Key       string          `json:"key"`
	Version   int             `json:"version"`
	Entries   json.RawMessage `json:"entries"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type Project struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenantId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Task struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenantId"`
	ProjectID string    `json:"projectId,omitempty"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type OutboxEvent struct {
	ID             string          `json:"id"`
	TenantID       string          `json:"tenantId"`
	Topic          string          `json:"topic"`
	Payload        json.RawMessage `json:"payload"`
	Attempts       int             `json:"attempts"`
	NextAttemptAt  *time.Time      `json:"nextAttemptAt,omitempty"`
	DeadLetteredAt *time.Time      `json:"deadLetteredAt,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
}

type AuditEvent struct {
	TenantID  string
	Subject   string
	Action    string
	RequestID string
	Payload   map[string]any
	CreatedAt time.Time
}
