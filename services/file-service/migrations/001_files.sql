CREATE SCHEMA IF NOT EXISTS axi_files;

CREATE TABLE IF NOT EXISTS axi_files.files (
    id UUID PRIMARY KEY,
    owner_subject TEXT NOT NULL,
    name TEXT NOT NULL,
    object_key TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_type TEXT,
    etag TEXT,
    checksum_sha256 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_subject, name)
);

ALTER TABLE axi_files.files
    ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;

CREATE INDEX IF NOT EXISTS files_owner_modified_idx
    ON axi_files.files (owner_subject, modified_at DESC, name);
