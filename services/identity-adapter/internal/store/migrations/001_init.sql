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
    challenge_id UUID NOT NULL,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verifications_expiry_idx
    ON axi_identity.email_verifications (expires_at);

-- Keep upgrades from the pre-challenge schema safe and idempotent. The old
-- token-hash uniqueness was both unnecessary and harmful for a six-digit code
-- space; challenge_id is now the only lookup key.
ALTER TABLE axi_identity.email_verifications
    ADD COLUMN IF NOT EXISTS challenge_id UUID;
UPDATE axi_identity.email_verifications SET challenge_id = id WHERE challenge_id IS NULL;
ALTER TABLE axi_identity.email_verifications
    ALTER COLUMN challenge_id SET NOT NULL;
ALTER TABLE axi_identity.email_verifications
    ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE axi_identity.email_verifications
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;
DROP INDEX IF EXISTS axi_identity.email_verifications_token_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_challenge_id_idx_v2
    ON axi_identity.email_verifications (challenge_id);

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
