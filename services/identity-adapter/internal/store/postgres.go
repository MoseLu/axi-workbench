package store

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_init.sql
var initialMigration string

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect identity postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping identity postgres: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) ApplyMigrations(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, initialMigration); err != nil {
		return fmt.Errorf("apply identity migration: %w", err)
	}
	return nil
}

func (s *PostgresStore) CreateQRTransaction(ctx context.Context, transaction model.QRTransaction) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO axi_identity.qr_transactions (
			id, ticket_hash, poll_token_hash, client_id, redirect_uri,
			code_challenge, code_challenge_method, state, status, expires_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		transaction.ID, transaction.TicketHash, transaction.PollTokenHash, transaction.ClientID,
		transaction.RedirectURI, transaction.CodeChallenge, transaction.CodeChallengeMethod,
		transaction.State, string(transaction.Status), transaction.ExpiresAt, transaction.CreatedAt, transaction.UpdatedAt,
	)
	return err
}

func (s *PostgresStore) GetQRTransaction(ctx context.Context, id string) (model.QRTransaction, error) {
	return scanQR(s.pool.QueryRow(ctx, qrSelect+` WHERE id = $1`, id))
}

func (s *PostgresStore) ApproveQRTransaction(ctx context.Context, id, ticketHash, subject string) (model.QRTransaction, error) {
	return scanQR(s.pool.QueryRow(ctx, `
		UPDATE axi_identity.qr_transactions
		SET subject = $3, status = 'approved', updated_at = now()
		WHERE id = $1
		  AND ticket_hash = $2
		  AND status = 'pending'
		  AND expires_at > now()
		RETURNING id, ticket_hash, poll_token_hash, COALESCE(resume_token_hash, ''), client_id,
		          redirect_uri, code_challenge, code_challenge_method, COALESCE(state, ''),
		          COALESCE(subject, ''), status, expires_at, created_at, updated_at`, id, ticketHash, subject))
}

func (s *PostgresStore) BeginQRResume(ctx context.Context, id, pollTokenHash, resumeTokenHash string) (model.QRTransaction, error) {
	return scanQR(s.pool.QueryRow(ctx, `
		UPDATE axi_identity.qr_transactions
		SET resume_token_hash = $3, status = 'resuming', updated_at = now()
		WHERE id = $1
		  AND poll_token_hash = $2
		  AND status = 'approved'
		  AND expires_at > now()
		RETURNING id, ticket_hash, poll_token_hash, COALESCE(resume_token_hash, ''), client_id,
		          redirect_uri, code_challenge, code_challenge_method, COALESCE(state, ''),
		          COALESCE(subject, ''), status, expires_at, created_at, updated_at`,
		id, pollTokenHash, resumeTokenHash,
	))
}

func (s *PostgresStore) ConsumeQRResume(ctx context.Context, id, resumeTokenHash string) (model.QRTransaction, error) {
	return scanQR(s.pool.QueryRow(ctx, `
		UPDATE axi_identity.qr_transactions
		SET resume_token_hash = NULL, status = 'consumed', updated_at = now()
		WHERE id = $1
		  AND resume_token_hash = $2
		  AND status = 'resuming'
		  AND expires_at > now()
		RETURNING id, ticket_hash, poll_token_hash, COALESCE(resume_token_hash, ''), client_id,
		          redirect_uri, code_challenge, code_challenge_method, COALESCE(state, ''),
		          COALESCE(subject, ''), status, expires_at, created_at, updated_at`,
		id, resumeTokenHash,
	))
}

func (s *PostgresStore) CreateEmailVerification(ctx context.Context, verification model.EmailVerification) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO axi_identity.email_verifications (id, email, purpose, token_hash, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		verification.ID, verification.Email, verification.Purpose, verification.TokenHash,
		verification.ExpiresAt, verification.CreatedAt,
	)
	return err
}

func (s *PostgresStore) ConsumeEmailVerification(ctx context.Context, tokenHash string) (model.EmailVerification, error) {
	var verification model.EmailVerification
	var consumedAt *time.Time
	err := s.pool.QueryRow(ctx, `
		UPDATE axi_identity.email_verifications
		SET consumed_at = now()
		WHERE token_hash = $1
		  AND consumed_at IS NULL
		  AND expires_at > now()
		RETURNING id, email, purpose, token_hash, expires_at, consumed_at, created_at`, tokenHash,
	).Scan(
		&verification.ID, &verification.Email, &verification.Purpose, &verification.TokenHash,
		&verification.ExpiresAt, &consumedAt, &verification.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.EmailVerification{}, ErrInvalidState
	}
	if err != nil {
		return model.EmailVerification{}, err
	}
	verification.ConsumedAt = consumedAt
	return verification, nil
}

func (s *PostgresStore) UpsertEPSIdentityLink(ctx context.Context, link model.EPSIdentityLink) (model.EPSIdentityLink, error) {
	var result model.EPSIdentityLink
	err := s.pool.QueryRow(ctx, `
		INSERT INTO axi_identity.eps_identity_links (
			provider, external_subject, subject, organization_ref, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (provider, subject) DO UPDATE
		SET external_subject = EXCLUDED.external_subject,
		    organization_ref = EXCLUDED.organization_ref,
		    updated_at = EXCLUDED.updated_at
		RETURNING provider, external_subject, subject, COALESCE(organization_ref, ''), created_at, updated_at`,
		link.Provider, link.ExternalSubject, link.Subject, nullableString(link.OrganizationRef), link.CreatedAt, link.UpdatedAt,
	).Scan(&result.Provider, &result.ExternalSubject, &result.Subject, &result.OrganizationRef, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		return model.EPSIdentityLink{}, err
	}
	return result, nil
}

func (s *PostgresStore) GetEPSIdentityLink(ctx context.Context, provider, subject string) (model.EPSIdentityLink, error) {
	var link model.EPSIdentityLink
	err := s.pool.QueryRow(ctx, `
		SELECT provider, external_subject, subject, COALESCE(organization_ref, ''), created_at, updated_at
		FROM axi_identity.eps_identity_links WHERE provider = $1 AND subject = $2`, provider, subject,
	).Scan(&link.Provider, &link.ExternalSubject, &link.Subject, &link.OrganizationRef, &link.CreatedAt, &link.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.EPSIdentityLink{}, ErrNotFound
	}
	if err != nil {
		return model.EPSIdentityLink{}, err
	}
	return link, nil
}

func (s *PostgresStore) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }
func (s *PostgresStore) Close()                         { s.pool.Close() }

const qrSelect = `
	SELECT id, ticket_hash, poll_token_hash, COALESCE(resume_token_hash, ''), client_id,
	       redirect_uri, code_challenge, code_challenge_method, COALESCE(state, ''),
	       COALESCE(subject, ''), status, expires_at, created_at, updated_at
	FROM axi_identity.qr_transactions`

func scanQR(row pgx.Row) (model.QRTransaction, error) {
	var transaction model.QRTransaction
	var status string
	err := row.Scan(
		&transaction.ID, &transaction.TicketHash, &transaction.PollTokenHash, &transaction.ResumeTokenHash,
		&transaction.ClientID, &transaction.RedirectURI, &transaction.CodeChallenge, &transaction.CodeChallengeMethod,
		&transaction.State, &transaction.Subject, &status, &transaction.ExpiresAt, &transaction.CreatedAt, &transaction.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.QRTransaction{}, ErrNotFound
	}
	if err != nil {
		return model.QRTransaction{}, err
	}
	transaction.Status = model.QRStatus(status)
	return transaction, nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
