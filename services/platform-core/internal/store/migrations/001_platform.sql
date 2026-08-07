-- Run this migration only through the dedicated migration job. The owner of
-- SECURITY DEFINER helpers must bypass RLS; the runtime application role must
-- not. This prevents a runtime credential from disabling tenant isolation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = current_user
          AND rolbypassrls
    ) THEN
        RAISE EXCEPTION 'platform migrations require a role with BYPASSRLS';
    END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS axi_platform;

CREATE OR REPLACE FUNCTION axi_platform.current_subject()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.subject', true), '');
$$;

CREATE OR REPLACE FUNCTION axi_platform.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS axi_platform.tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS axi_platform.tenant_memberships (
    tenant_id UUID NOT NULL REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, subject)
);

CREATE TABLE IF NOT EXISTS axi_platform.user_preferences (
    subject TEXT PRIMARY KEY,
    locale TEXT NOT NULL DEFAULT 'zh-CN',
    theme TEXT NOT NULL DEFAULT 'system',
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    notifications_muted BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS axi_platform.dictionaries (
    tenant_id UUID NOT NULL REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    entries JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS axi_platform.projects (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_tenant_created_idx
    ON axi_platform.projects (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS axi_platform.tasks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES axi_platform.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_tenant_created_idx
    ON axi_platform.tasks (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS axi_platform.audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    subject TEXT,
    action TEXT NOT NULL,
    request_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
    ON axi_platform.audit_events (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS axi_platform.outbox_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES axi_platform.tenants(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    dead_lettered_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE axi_platform.outbox_events
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE axi_platform.outbox_events
    ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS outbox_events_delivery_idx
    ON axi_platform.outbox_events (delivered_at, locked_until, created_at);
CREATE INDEX IF NOT EXISTS outbox_events_claim_idx
    ON axi_platform.outbox_events (delivered_at, dead_lettered_at, next_attempt_at, locked_until, created_at);

CREATE OR REPLACE FUNCTION axi_platform.has_tenant_role(p_tenant_id UUID, p_subject TEXT, p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM tenant_memberships membership
        WHERE membership.tenant_id = p_tenant_id
          AND membership.subject = p_subject
          AND membership.role = ANY(p_roles)
    );
$$;

CREATE OR REPLACE FUNCTION axi_platform.create_tenant(p_id UUID, p_name TEXT, p_slug TEXT, p_subject TEXT)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
BEGIN
    INSERT INTO tenants (id, name, slug, created_by)
    VALUES (p_id, p_name, p_slug, p_subject);
    INSERT INTO tenant_memberships (tenant_id, subject, role)
    VALUES (p_id, p_subject, 'owner');
    RETURN QUERY SELECT tenant.id, tenant.name, tenant.slug, tenant.created_at
    FROM tenants tenant WHERE tenant.id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION axi_platform.claim_outbox_events(p_limit INTEGER)
RETURNS SETOF axi_platform.outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT event.id
        FROM outbox_events event
        WHERE event.delivered_at IS NULL
	  AND event.dead_lettered_at IS NULL
	  AND (event.next_attempt_at IS NULL OR event.next_attempt_at <= now())
          AND (event.locked_until IS NULL OR event.locked_until < now())
        ORDER BY event.created_at
        LIMIT GREATEST(p_limit, 1)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events event
    SET locked_until = now() + interval '5 minutes', attempts = event.attempts + 1
    FROM candidates
    WHERE event.id = candidates.id
    RETURNING event.*;
END;
$$;

CREATE OR REPLACE FUNCTION axi_platform.mark_outbox_delivered(p_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
    UPDATE outbox_events
    SET delivered_at = now(), locked_until = NULL, next_attempt_at = NULL, last_error = NULL
    WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION axi_platform.release_outbox_event(p_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
    UPDATE outbox_events
    SET locked_until = NULL,
        last_error = left(p_error, 1000),
        next_attempt_at = CASE
            WHEN attempts >= 10 THEN NULL
            ELSE now() + (LEAST(300, power(2, LEAST(attempts, 8))::integer) * interval '1 second')
        END,
        dead_lettered_at = CASE WHEN attempts >= 10 THEN now() ELSE NULL END
    WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION axi_platform.append_audit_event(
    p_id UUID,
    p_tenant_id UUID,
    p_subject TEXT,
    p_action TEXT,
    p_request_id TEXT,
    p_payload JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = axi_platform, pg_catalog
AS $$
    INSERT INTO audit_events (id, tenant_id, subject, action, request_id, payload)
    VALUES (p_id, p_tenant_id, p_subject, p_action, p_request_id, COALESCE(p_payload, '{}'::jsonb));
$$;

ALTER TABLE axi_platform.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.user_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.dictionaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.dictionaries FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE axi_platform.outbox_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_read_policy ON axi_platform.tenants;
CREATE POLICY tenant_read_policy ON axi_platform.tenants
    FOR SELECT
    USING (axi_platform.has_tenant_role(id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor', 'viewer']));

DROP POLICY IF EXISTS membership_read_policy ON axi_platform.tenant_memberships;
CREATE POLICY membership_read_policy ON axi_platform.tenant_memberships
    FOR SELECT
    USING (
        subject = axi_platform.current_subject()
        OR axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS membership_write_policy ON axi_platform.tenant_memberships;
DROP POLICY IF EXISTS membership_insert_policy ON axi_platform.tenant_memberships;
DROP POLICY IF EXISTS membership_update_policy ON axi_platform.tenant_memberships;
DROP POLICY IF EXISTS membership_delete_policy ON axi_platform.tenant_memberships;
CREATE POLICY membership_insert_policy ON axi_platform.tenant_memberships
    FOR INSERT
    WITH CHECK (axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin']));
CREATE POLICY membership_update_policy ON axi_platform.tenant_memberships
    FOR UPDATE
    USING (
        axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
        AND (role <> 'owner' OR subject = axi_platform.current_subject())
    )
    WITH CHECK (axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin']));
CREATE POLICY membership_delete_policy ON axi_platform.tenant_memberships
    FOR DELETE
    USING (
        axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
        AND (role <> 'owner' OR subject = axi_platform.current_subject())
    );

DROP POLICY IF EXISTS preferences_policy ON axi_platform.user_preferences;
CREATE POLICY preferences_policy ON axi_platform.user_preferences
    FOR ALL
    USING (subject = axi_platform.current_subject())
    WITH CHECK (subject = axi_platform.current_subject());

DROP POLICY IF EXISTS dictionaries_read_policy ON axi_platform.dictionaries;
CREATE POLICY dictionaries_read_policy ON axi_platform.dictionaries
    FOR SELECT
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor', 'viewer'])
    );

DROP POLICY IF EXISTS dictionaries_write_policy ON axi_platform.dictionaries;
CREATE POLICY dictionaries_write_policy ON axi_platform.dictionaries
    FOR ALL
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
    )
    WITH CHECK (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS projects_read_policy ON axi_platform.projects;
CREATE POLICY projects_read_policy ON axi_platform.projects
    FOR SELECT
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor', 'viewer'])
    );

DROP POLICY IF EXISTS projects_write_policy ON axi_platform.projects;
CREATE POLICY projects_write_policy ON axi_platform.projects
    FOR ALL
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor'])
    )
    WITH CHECK (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor'])
    );

DROP POLICY IF EXISTS tasks_read_policy ON axi_platform.tasks;
CREATE POLICY tasks_read_policy ON axi_platform.tasks
    FOR SELECT
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor', 'viewer'])
    );

DROP POLICY IF EXISTS tasks_write_policy ON axi_platform.tasks;
CREATE POLICY tasks_write_policy ON axi_platform.tasks
    FOR ALL
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor'])
    )
    WITH CHECK (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor'])
    );

DROP POLICY IF EXISTS audit_events_policy ON axi_platform.audit_events;
CREATE POLICY audit_events_policy ON axi_platform.audit_events
    FOR SELECT
    USING (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin'])
    );

DROP POLICY IF EXISTS outbox_events_policy ON axi_platform.outbox_events;
CREATE POLICY outbox_events_policy ON axi_platform.outbox_events
    FOR INSERT
    WITH CHECK (
        tenant_id = axi_platform.current_tenant_id()
        AND axi_platform.has_tenant_role(tenant_id, axi_platform.current_subject(), ARRAY['owner', 'admin', 'editor'])
    );

-- The runtime role must be NOBYPASSRLS. Migrations run with the dedicated
-- BYPASSRLS role; application deployments receive only restricted credentials.
REVOKE ALL ON SCHEMA axi_platform FROM PUBLIC;
GRANT USAGE ON SCHEMA axi_platform TO axi_platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA axi_platform TO axi_platform_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA axi_platform TO axi_platform_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axi_platform FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA axi_platform TO axi_platform_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA axi_platform
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO axi_platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA axi_platform
    GRANT USAGE, SELECT ON SEQUENCES TO axi_platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA axi_platform
    GRANT EXECUTE ON FUNCTIONS TO axi_platform_app;
