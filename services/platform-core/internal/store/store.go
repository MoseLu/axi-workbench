package store

import (
	"context"
	"errors"

	"github.com/axi-workbench/platform-core/internal/model"
)

var (
	ErrNotFound  = errors.New("platform record not found")
	ErrForbidden = errors.New("platform action is forbidden")
	ErrConflict  = errors.New("platform record conflicts with current state")
)

// Store receives an authenticated OIDC subject from the gateway, never a
// client supplied user ID. Tenant methods must enforce membership themselves,
// in addition to PostgreSQL RLS in the production implementation.
type Store interface {
	CreateTenant(context.Context, string, string, string) (model.Tenant, error)
	ListTenants(context.Context, string) ([]model.Tenant, error)
	ListMembers(context.Context, string, string) ([]model.Membership, error)
	UpsertMember(context.Context, string, string, string, model.Role) (model.Membership, error)

	GetPreferences(context.Context, string) (model.Preferences, error)
	SavePreferences(context.Context, model.Preferences) (model.Preferences, error)

	GetDictionary(context.Context, string, string, string) (model.Dictionary, error)
	PutDictionary(context.Context, string, model.Dictionary) (model.Dictionary, error)

	ListProjects(context.Context, string, string) ([]model.Project, error)
	CreateProject(context.Context, string, model.Project) (model.Project, error)
	ListTasks(context.Context, string, string) ([]model.Task, error)
	CreateTask(context.Context, string, model.Task) (model.Task, error)
	AppendAudit(context.Context, model.AuditEvent) error

	ClaimOutbox(context.Context, int) ([]model.OutboxEvent, error)
	MarkOutboxDelivered(context.Context, string) error
	ReleaseOutbox(context.Context, string, string) error
	Ping(context.Context) error
	Close()
}
