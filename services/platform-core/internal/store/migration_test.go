package store

import (
	"strings"
	"testing"
)

func TestPlatformMigrationForcesTenantRLS(t *testing.T) {
	if !strings.Contains(initialMigration, "rolbypassrls") {
		t.Fatal("platform migration must require a BYPASSRLS migration role")
	}
	for _, table := range []string{
		"tenant_memberships",
		"dictionaries",
		"projects",
		"tasks",
		"audit_events",
		"outbox_events",
	} {
		if !strings.Contains(initialMigration, "ALTER TABLE axi_platform."+table+" ENABLE ROW LEVEL SECURITY") {
			t.Fatalf("%s is missing ENABLE ROW LEVEL SECURITY", table)
		}
		if !strings.Contains(initialMigration, "ALTER TABLE axi_platform."+table+" FORCE ROW LEVEL SECURITY") {
			t.Fatalf("%s is missing FORCE ROW LEVEL SECURITY", table)
		}
	}
	for _, table := range []string{"tenant_memberships", "dictionaries", "projects", "tasks", "outbox_events"} {
		if !strings.Contains(initialMigration, "CREATE TABLE IF NOT EXISTS axi_platform."+table) {
			t.Fatalf("%s is absent from platform migration", table)
		}
	}
	if !strings.Contains(initialMigration, "tenant_id UUID NOT NULL") {
		t.Fatal("tenant-bound records must have non-null tenant_id")
	}
	for _, statement := range []string{
		"GRANT USAGE ON SCHEMA axi_platform TO axi_platform_app",
		"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA axi_platform TO axi_platform_app",
		"REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axi_platform FROM PUBLIC",
		"CREATE OR REPLACE FUNCTION axi_platform.append_audit_event",
		"next_attempt_at TIMESTAMPTZ",
		"dead_lettered_at TIMESTAMPTZ",
		"interval '5 minutes'",
		"WHEN attempts >= 10 THEN now()",
		"CREATE POLICY membership_update_policy",
		"role <> 'owner' OR subject = axi_platform.current_subject()",
	} {
		if !strings.Contains(initialMigration, statement) {
			t.Fatalf("platform migration is missing least-privilege grant %q", statement)
		}
	}
}
