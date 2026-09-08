//go:build integration

package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/axi-workbench/platform-core/internal/model"
)

// This test is intentionally opt-in because it requires two disposable
// PostgreSQL DSNs: a BYPASSRLS migration role and the NOBYPASSRLS runtime role.
// It verifies both the API-level 403 boundary and the database-level invisible
// row boundary, rather than trusting an in-memory store alone.
func TestPostgresRLSDeniesCrossTenantAccess(t *testing.T) {
	migrationURL := os.Getenv("PLATFORM_TEST_MIGRATION_DATABASE_URL")
	runtimeURL := os.Getenv("PLATFORM_TEST_DATABASE_URL")
	if migrationURL == "" || runtimeURL == "" {
		t.Skip("set PLATFORM_TEST_MIGRATION_DATABASE_URL and PLATFORM_TEST_DATABASE_URL to run PostgreSQL RLS integration")
	}

	ctx := context.Background()
	migrator, err := NewPostgres(ctx, migrationURL)
	if err != nil {
		t.Fatalf("connect migration database: %v", err)
	}
	defer migrator.Close()
	if err := migrator.ApplyMigrations(ctx); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	runtime, err := NewPostgres(ctx, runtimeURL)
	if err != nil {
		t.Fatalf("connect runtime database: %v", err)
	}
	defer runtime.Close()

	suffix := time.Now().UTC().UnixNano()
	tenant, err := runtime.CreateTenant(ctx, "zitadel-alice", "RLS integration", fmt.Sprintf("rls-%d", suffix))
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	defer func() {
		if _, err := migrator.pool.Exec(ctx, `DELETE FROM axi_platform.tenants WHERE id = $1::uuid`, tenant.ID); err != nil {
			t.Errorf("cleanup tenant: %v", err)
		}
	}()

	if _, err := runtime.CreateProject(ctx, "zitadel-alice", model.Project{TenantID: tenant.ID, Name: "Private"}); err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := runtime.UpsertMember(ctx, "zitadel-alice", tenant.ID, "zitadel-bob", model.RoleOwner); err != nil {
		t.Fatalf("create second owner: %v", err)
	}
	if _, err := runtime.UpsertMember(ctx, "zitadel-alice", tenant.ID, "zitadel-carol", model.RoleAdmin); err != nil {
		t.Fatalf("create admin: %v", err)
	}
	if _, err := runtime.UpsertMember(ctx, "zitadel-carol", tenant.ID, "zitadel-bob", model.RoleViewer); err != ErrForbidden {
		t.Fatalf("admin owner downgrade error = %v, want %v", err, ErrForbidden)
	}
	ownerMutation, err := runtime.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin owner-protection transaction: %v", err)
	}
	defer ownerMutation.Rollback(ctx)
	if _, err := ownerMutation.Exec(ctx, `SELECT set_config('app.subject', 'zitadel-carol', true)`); err != nil {
		t.Fatalf("set admin subject: %v", err)
	}
	if _, err := ownerMutation.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenant.ID); err != nil {
		t.Fatalf("set admin tenant: %v", err)
	}
	tag, err := ownerMutation.Exec(ctx, `
		UPDATE axi_platform.tenant_memberships
		SET role = 'viewer'
		WHERE tenant_id = $1::uuid AND subject = 'zitadel-bob'`, tenant.ID)
	if err != nil {
		t.Fatalf("direct owner downgrade query: %v", err)
	}
	if tag.RowsAffected() != 0 {
		t.Fatalf("RLS allowed an admin to downgrade %d owner rows", tag.RowsAffected())
	}

	if _, err := runtime.ListProjects(ctx, "zitadel-eve", tenant.ID); err != ErrForbidden {
		t.Fatalf("application cross-tenant read error = %v, want %v", err, ErrForbidden)
	}

	tx, err := runtime.pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin direct RLS transaction: %v", err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT set_config('app.subject', 'zitadel-eve', true)`); err != nil {
		t.Fatalf("set subject: %v", err)
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, tenant.ID); err != nil {
		t.Fatalf("set tenant: %v", err)
	}
	var visible int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM axi_platform.projects WHERE tenant_id = $1::uuid`, tenant.ID).Scan(&visible); err != nil {
		t.Fatalf("query RLS-protected projects: %v", err)
	}
	if visible != 0 {
		t.Fatalf("RLS exposed %d foreign project rows", visible)
	}
}
