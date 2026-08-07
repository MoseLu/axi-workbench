CREATE SCHEMA IF NOT EXISTS axi_workflow;

CREATE TABLE IF NOT EXISTS axi_workflow.workflows (
    id UUID PRIMARY KEY,
    owner_subject TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at TIMESTAMPTZ,
    result JSONB
);

CREATE INDEX IF NOT EXISTS workflows_owner_created_idx
    ON axi_workflow.workflows (owner_subject, created_at DESC);

CREATE INDEX IF NOT EXISTS workflows_running_idx
    ON axi_workflow.workflows (status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS axi_workflow.executions (
    workflow_id UUID PRIMARY KEY REFERENCES axi_workflow.workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    result JSONB,
    error TEXT
);

-- Platform Core delivers at least once. Persisting the event ID at the
-- workflow boundary makes retries harmless before trigger routing is added.
CREATE TABLE IF NOT EXISTS axi_workflow.event_inbox (
    event_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_event_inbox_topic_idx
    ON axi_workflow.event_inbox (topic, received_at DESC);
