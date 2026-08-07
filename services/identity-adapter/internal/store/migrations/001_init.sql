CREATE SCHEMA IF NOT EXISTS axi_identity;

CREATE TABLE IF NOT EXISTS axi_identity.qr_transactions (
    id UUID PRIMARY KEY,
    ticket_hash TEXT NOT NULL,
    poll_token_hash TEXT NOT NULL,
    resume_token_hash TEXT,
    client_id TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL CHECK (code_challenge_method = 'S256'),
    state TEXT,
    subject TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'resuming', 'consumed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qr_transactions_expiry_idx
    ON axi_identity.qr_transactions (expires_at);

CREATE TABLE IF NOT EXISTS axi_identity.email_verifications (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verifications_expiry_idx
    ON axi_identity.email_verifications (expires_at);

CREATE TABLE IF NOT EXISTS axi_identity.eps_identity_links (
    provider TEXT NOT NULL,
    external_subject TEXT NOT NULL,
    subject TEXT NOT NULL,
    organization_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject),
    UNIQUE (provider, external_subject)
);
