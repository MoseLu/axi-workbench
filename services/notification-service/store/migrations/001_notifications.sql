CREATE SCHEMA IF NOT EXISTS axi_notifications;

CREATE TABLE IF NOT EXISTS axi_notifications.notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'me',
    dot_only BOOLEAN NOT NULL DEFAULT false,
    is_read BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
    ON axi_notifications.notifications (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON axi_notifications.notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS axi_notifications.delivery_jobs (
    notification_id TEXT PRIMARY KEY REFERENCES axi_notifications.notifications(id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ,
    dead_lettered_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS notification_delivery_claim_idx
    ON axi_notifications.delivery_jobs (delivered_at, dead_lettered_at, next_attempt_at, locked_until);
