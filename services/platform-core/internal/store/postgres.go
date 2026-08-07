package store

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/axi-workbench/platform-core/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_platform.sql
var initialMigration string

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect platform postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping platform postgres: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) ApplyMigrations(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, initialMigration); err != nil {
		return fmt.Errorf("apply platform migration: %w", err)
	}
	return nil
}

func (s *PostgresStore) CreateTenant(ctx context.Context, subject, name, slug string) (model.Tenant, error) {
	var tenant model.Tenant
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, name, slug, created_at
		FROM axi_platform.create_tenant($1::uuid, $2, $3, $4, $5::uuid)`,
		uuid.NewString(), name, slug, subject, uuid.NewString(),
	).Scan(&tenant.ID, &tenant.Name, &tenant.Slug, &tenant.CreatedAt)
	return tenant, normalizeError(err)
}

func (s *PostgresStore) ListTenants(ctx context.Context, subject string) ([]model.Tenant, error) {
	var result []model.Tenant
	err := s.withSubject(ctx, subject, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id::text, name, slug, created_at FROM axi_platform.tenants ORDER BY created_at`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var tenant model.Tenant
			if err := rows.Scan(&tenant.ID, &tenant.Name, &tenant.Slug, &tenant.CreatedAt); err != nil {
				return err
			}
			result = append(result, tenant)
		}
		return rows.Err()
	})
	return result, normalizeError(err)
}

func (s *PostgresStore) ListMembers(ctx context.Context, subject, tenantID string) ([]model.Membership, error) {
	var result []model.Membership
	err := s.withTenant(ctx, subject, tenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, tenantID, subject, model.RoleOwner, model.RoleAdmin, model.RoleEditor, model.RoleViewer); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT tenant_id::text, subject, role, created_at, updated_at
			FROM axi_platform.tenant_memberships
			WHERE tenant_id = $1::uuid ORDER BY subject`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			member, err := scanMembership(rows)
			if err != nil {
				return err
			}
			result = append(result, member)
		}
		return rows.Err()
	})
	return result, normalizeError(err)
}

func (s *PostgresStore) UpsertMember(ctx context.Context, actor, tenantID, memberSubject string, role model.Role) (model.Membership, error) {
	var membership model.Membership
	err := s.withTenant(ctx, actor, tenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, tenantID, actor, model.RoleOwner, model.RoleAdmin); err != nil {
			return err
		}
		var existingRole string
		err := tx.QueryRow(ctx, `
			SELECT role FROM axi_platform.tenant_memberships
			WHERE tenant_id = $1::uuid AND subject = $2
			FOR UPDATE`, tenantID, memberSubject,
		).Scan(&existingRole)
		if err == nil && model.Role(existingRole) == model.RoleOwner && role != model.RoleOwner && memberSubject != actor {
			return ErrForbidden
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		var roleText string
		err = tx.QueryRow(ctx, `
			INSERT INTO axi_platform.tenant_memberships (tenant_id, subject, role)
			VALUES ($1::uuid, $2, $3)
			ON CONFLICT (tenant_id, subject) DO UPDATE
			SET role = EXCLUDED.role, updated_at = now()
			RETURNING tenant_id::text, subject, role, created_at, updated_at`,
			tenantID, memberSubject, string(role),
		).Scan(&membership.TenantID, &membership.Subject, &roleText, &membership.CreatedAt, &membership.UpdatedAt)
		membership.Role = model.Role(roleText)
		if err != nil {
			return err
		}
		return s.insertOutbox(ctx, tx, tenantID, "tenant.member.changed", map[string]string{
			"tenantId": tenantID, "subject": memberSubject, "role": string(role), "changedBy": actor,
		})
	})
	return membership, normalizeError(err)
}

func (s *PostgresStore) GetPreferences(ctx context.Context, subject string) (model.Preferences, error) {
	preferences := defaultPreferences(subject)
	err := s.withSubject(ctx, subject, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			SELECT subject, locale, theme, timezone, notifications_muted, updated_at
			FROM axi_platform.user_preferences WHERE subject = $1`, subject,
		).Scan(&preferences.Subject, &preferences.Locale, &preferences.Theme, &preferences.Timezone, &preferences.NotificationsMuted, &preferences.UpdatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	})
	return preferences, normalizeError(err)
}

func (s *PostgresStore) SavePreferences(ctx context.Context, preferences model.Preferences) (model.Preferences, error) {
	err := s.withSubject(ctx, preferences.Subject, func(tx pgx.Tx) error {
		return tx.QueryRow(ctx, `
			INSERT INTO axi_platform.user_preferences (subject, locale, theme, timezone, notifications_muted)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (subject) DO UPDATE
			SET locale = EXCLUDED.locale,
			    theme = EXCLUDED.theme,
			    timezone = EXCLUDED.timezone,
			    notifications_muted = EXCLUDED.notifications_muted,
			    updated_at = now()
			RETURNING subject, locale, theme, timezone, notifications_muted, updated_at`,
			preferences.Subject, preferences.Locale, preferences.Theme, preferences.Timezone, preferences.NotificationsMuted,
		).Scan(&preferences.Subject, &preferences.Locale, &preferences.Theme, &preferences.Timezone, &preferences.NotificationsMuted, &preferences.UpdatedAt)
	})
	return preferences, normalizeError(err)
}

func (s *PostgresStore) GetDictionary(ctx context.Context, subject, tenantID, key string) (model.Dictionary, error) {
	var dictionary model.Dictionary
	err := s.withTenant(ctx, subject, tenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, tenantID, subject, model.RoleOwner, model.RoleAdmin, model.RoleEditor, model.RoleViewer); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `
			SELECT tenant_id::text, key, version, entries, updated_at
			FROM axi_platform.dictionaries WHERE tenant_id = $1::uuid AND key = $2`, tenantID, key,
		).Scan(&dictionary.TenantID, &dictionary.Key, &dictionary.Version, &dictionary.Entries, &dictionary.UpdatedAt)
		return err
	})
	return dictionary, normalizeError(err)
}

func (s *PostgresStore) PutDictionary(ctx context.Context, actor string, dictionary model.Dictionary) (model.Dictionary, error) {
	err := s.withTenant(ctx, actor, dictionary.TenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, dictionary.TenantID, actor, model.RoleOwner, model.RoleAdmin); err != nil {
			return err
		}
		err := tx.QueryRow(ctx, `
			INSERT INTO axi_platform.dictionaries (tenant_id, key, version, entries, updated_by)
			VALUES ($1::uuid, $2, 1, $3::jsonb, $4)
			ON CONFLICT (tenant_id, key) DO UPDATE
			SET version = axi_platform.dictionaries.version + 1,
			    entries = EXCLUDED.entries,
			    updated_by = EXCLUDED.updated_by,
			    updated_at = now()
			RETURNING tenant_id::text, key, version, entries, updated_at`,
			dictionary.TenantID, dictionary.Key, dictionary.Entries, actor,
		).Scan(&dictionary.TenantID, &dictionary.Key, &dictionary.Version, &dictionary.Entries, &dictionary.UpdatedAt)
		if err != nil {
			return err
		}
		return s.insertOutbox(ctx, tx, dictionary.TenantID, "dictionary.changed", map[string]any{"tenantId": dictionary.TenantID, "key": dictionary.Key, "version": dictionary.Version})
	})
	return dictionary, normalizeError(err)
}

func (s *PostgresStore) ListProjects(ctx context.Context, subject, tenantID string) ([]model.Project, error) {
	var result []model.Project
	err := s.withTenant(ctx, subject, tenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, tenantID, subject, model.RoleOwner, model.RoleAdmin, model.RoleEditor, model.RoleViewer); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id::text, tenant_id::text, name, description, created_by, created_at, updated_at
			FROM axi_platform.projects WHERE tenant_id = $1::uuid ORDER BY created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var project model.Project
			if err := rows.Scan(&project.ID, &project.TenantID, &project.Name, &project.Description, &project.CreatedBy, &project.CreatedAt, &project.UpdatedAt); err != nil {
				return err
			}
			result = append(result, project)
		}
		return rows.Err()
	})
	return result, normalizeError(err)
}

func (s *PostgresStore) CreateProject(ctx context.Context, actor string, project model.Project) (model.Project, error) {
	err := s.withTenant(ctx, actor, project.TenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, project.TenantID, actor, model.RoleOwner, model.RoleAdmin, model.RoleEditor); err != nil {
			return err
		}
		project.ID = uuid.NewString()
		project.CreatedBy = actor
		err := tx.QueryRow(ctx, `
			INSERT INTO axi_platform.projects (id, tenant_id, name, description, created_by)
			VALUES ($1::uuid, $2::uuid, $3, $4, $5)
			RETURNING created_at, updated_at`, project.ID, project.TenantID, project.Name, project.Description, actor,
		).Scan(&project.CreatedAt, &project.UpdatedAt)
		if err != nil {
			return err
		}
		return s.insertOutbox(ctx, tx, project.TenantID, "project.created", map[string]string{
			"tenantId": project.TenantID, "projectId": project.ID, "name": project.Name, "createdBy": project.CreatedBy,
		})
	})
	return project, normalizeError(err)
}

func (s *PostgresStore) ListTasks(ctx context.Context, subject, tenantID string) ([]model.Task, error) {
	var result []model.Task
	err := s.withTenant(ctx, subject, tenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, tenantID, subject, model.RoleOwner, model.RoleAdmin, model.RoleEditor, model.RoleViewer); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT id::text, tenant_id::text, COALESCE(project_id::text, ''), title, status, created_by, created_at, updated_at
			FROM axi_platform.tasks WHERE tenant_id = $1::uuid ORDER BY created_at`, tenantID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var task model.Task
			if err := rows.Scan(&task.ID, &task.TenantID, &task.ProjectID, &task.Title, &task.Status, &task.CreatedBy, &task.CreatedAt, &task.UpdatedAt); err != nil {
				return err
			}
			result = append(result, task)
		}
		return rows.Err()
	})
	return result, normalizeError(err)
}

func (s *PostgresStore) CreateTask(ctx context.Context, actor string, task model.Task) (model.Task, error) {
	err := s.withTenant(ctx, actor, task.TenantID, func(tx pgx.Tx) error {
		if err := requireTenantRole(ctx, tx, task.TenantID, actor, model.RoleOwner, model.RoleAdmin, model.RoleEditor); err != nil {
			return err
		}
		if task.ProjectID != "" {
			var projectID string
			err := tx.QueryRow(ctx, `SELECT id::text FROM axi_platform.projects WHERE id = $1::uuid AND tenant_id = $2::uuid`, task.ProjectID, task.TenantID).Scan(&projectID)
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrConflict
			}
			if err != nil {
				return err
			}
		}
		task.ID = uuid.NewString()
		task.CreatedBy = actor
		if task.Status == "" {
			task.Status = "todo"
		}
		err := tx.QueryRow(ctx, `
			INSERT INTO axi_platform.tasks (id, tenant_id, project_id, title, status, created_by)
			VALUES ($1::uuid, $2::uuid, NULLIF($3, '')::uuid, $4, $5, $6)
			RETURNING created_at, updated_at`, task.ID, task.TenantID, task.ProjectID, task.Title, task.Status, actor,
		).Scan(&task.CreatedAt, &task.UpdatedAt)
		if err != nil {
			return err
		}
		return s.insertOutbox(ctx, tx, task.TenantID, "task.created", map[string]string{
			"tenantId": task.TenantID, "taskId": task.ID, "projectId": task.ProjectID,
			"title": task.Title, "createdBy": task.CreatedBy,
		})
	})
	return task, normalizeError(err)
}

func (s *PostgresStore) AppendAudit(ctx context.Context, event model.AuditEvent) error {
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("encode audit payload: %w", err)
	}
	_, err = s.pool.Exec(ctx, `
		SELECT axi_platform.append_audit_event($1::uuid, NULLIF($2, '')::uuid, NULLIF($3, ''), $4, NULLIF($5, ''), $6::jsonb)`,
		uuid.NewString(), event.TenantID, event.Subject, event.Action, event.RequestID, payload,
	)
	return normalizeError(err)
}

func (s *PostgresStore) ClaimOutbox(ctx context.Context, limit int) ([]model.OutboxEvent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, tenant_id::text, topic, payload, attempts, next_attempt_at, dead_lettered_at, created_at
		FROM axi_platform.claim_outbox_events($1)`, limit)
	if err != nil {
		return nil, normalizeError(err)
	}
	defer rows.Close()
	result := make([]model.OutboxEvent, 0)
	for rows.Next() {
		var event model.OutboxEvent
		if err := rows.Scan(&event.ID, &event.TenantID, &event.Topic, &event.Payload, &event.Attempts, &event.NextAttemptAt, &event.DeadLetteredAt, &event.CreatedAt); err != nil {
			return nil, normalizeError(err)
		}
		result = append(result, event)
	}
	return result, normalizeError(rows.Err())
}

func (s *PostgresStore) MarkOutboxDelivered(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `SELECT axi_platform.mark_outbox_delivered($1::uuid)`, id)
	return normalizeError(err)
}

func (s *PostgresStore) ReleaseOutbox(ctx context.Context, id, reason string) error {
	_, err := s.pool.Exec(ctx, `SELECT axi_platform.release_outbox_event($1::uuid, $2)`, id, reason)
	return normalizeError(err)
}

func (s *PostgresStore) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }
func (s *PostgresStore) Close()                         { s.pool.Close() }

func (s *PostgresStore) withSubject(ctx context.Context, subject string, work func(pgx.Tx) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT set_config('app.subject', $1, true)`, subject); err != nil {
		return err
	}
	if err := work(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PostgresStore) withTenant(ctx context.Context, subject, tenantID string, work func(pgx.Tx) error) error {
	if _, err := uuid.Parse(tenantID); err != nil {
		return ErrNotFound
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT set_config('app.subject', $1, true)`, subject); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenantID); err != nil {
		return err
	}
	if err := work(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func requireTenantRole(ctx context.Context, tx pgx.Tx, tenantID, subject string, roles ...model.Role) error {
	allowedRoles := make([]string, 0, len(roles))
	for _, role := range roles {
		allowedRoles = append(allowedRoles, string(role))
	}
	var allowed bool
	if err := tx.QueryRow(ctx, `
		SELECT axi_platform.has_tenant_role($1::uuid, $2, $3::text[])`,
		tenantID, subject, allowedRoles,
	).Scan(&allowed); err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func (s *PostgresStore) insertOutbox(ctx context.Context, tx pgx.Tx, tenantID, topic string, payload any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO axi_platform.outbox_events (id, tenant_id, topic, payload)
		VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`, uuid.NewString(), tenantID, topic, encoded)
	return err
}

func scanMembership(row pgx.Row) (model.Membership, error) {
	var membership model.Membership
	var role string
	err := row.Scan(&membership.TenantID, &membership.Subject, &role, &membership.CreatedAt, &membership.UpdatedAt)
	membership.Role = model.Role(role)
	return membership, err
}

func defaultPreferences(subject string) model.Preferences {
	return model.Preferences{Subject: subject, Locale: "zh-CN", Theme: "system", Timezone: "Asia/Shanghai"}
}

func normalizeError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) {
		switch postgresError.Code {
		case "23505":
			return ErrConflict
		case "42501":
			return ErrForbidden
		}
	}
	return err
}
