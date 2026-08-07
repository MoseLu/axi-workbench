CREATE SCHEMA IF NOT EXISTS axi_workflow;

CREATE TABLE IF NOT EXISTS axi_workflow.workflows (
    id UUID PRIMARY KEY,
    owner_subject TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_topic TEXT,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at TIMESTAMPTZ,
    result JSONB
);

ALTER TABLE axi_workflow.workflows
    ADD COLUMN IF NOT EXISTS trigger_topic TEXT;

CREATE INDEX IF NOT EXISTS workflows_owner_created_idx
    ON axi_workflow.workflows (owner_subject, created_at DESC);

CREATE INDEX IF NOT EXISTS workflows_running_idx
    ON axi_workflow.workflows (status) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS workflows_trigger_topic_idx
    ON axi_workflow.workflows (trigger_topic, owner_subject)
    WHERE trigger_topic IS NOT NULL;

CREATE TABLE IF NOT EXISTS axi_workflow.executions (
    workflow_id UUID PRIMARY KEY REFERENCES axi_workflow.workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    result JSONB,
    error TEXT,
    pending_approval JSONB
);

ALTER TABLE axi_workflow.executions
    ADD COLUMN IF NOT EXISTS pending_approval JSONB;

CREATE TABLE IF NOT EXISTS axi_workflow.approvals (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES axi_workflow.workflows(id) ON DELETE CASCADE,
    step_id UUID NOT NULL,
    owner_subject TEXT NOT NULL,
    step_name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    approvers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    decided_by TEXT,
    decision_comment TEXT
);

CREATE INDEX IF NOT EXISTS workflow_approvals_owner_status_idx
    ON axi_workflow.approvals (owner_subject, status, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_approvals_pending_workflow_idx
    ON axi_workflow.approvals (workflow_id) WHERE status = 'pending';

-- Platform Core delivers at least once. Persisting the event ID at the
-- workflow boundary makes retries harmless before a dispatch is created.
CREATE TABLE IF NOT EXISTS axi_workflow.event_inbox (
    event_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS axi_workflow.event_dispatches (
    event_id TEXT NOT NULL REFERENCES axi_workflow.event_inbox(event_id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES axi_workflow.workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_by TEXT,
    locked_until TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (event_id, workflow_id)
);

ALTER TABLE axi_workflow.event_dispatches
    ADD COLUMN IF NOT EXISTS locked_by TEXT;

CREATE INDEX IF NOT EXISTS workflow_event_dispatch_claim_idx
    ON axi_workflow.event_dispatches (status, next_attempt_at, locked_until, created_at);

CREATE INDEX IF NOT EXISTS workflow_event_inbox_topic_idx
    ON axi_workflow.event_inbox (topic, received_at DESC);
