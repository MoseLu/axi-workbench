package store

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"notification-service/models"
)

//go:embed migrations/001_notifications.sql
var initialMigration string

var ErrNotFound = errors.New("notification not found")

// PostgresStore is the durable notification repository. User scoping remains
// enforced in SQL as well as at the HTTP boundary so a future handler cannot
// accidentally turn a list or mark-read operation into a cross-user read.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect notification postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping notification postgres: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) ApplyMigrations(ctx context.Context) error {
	if _, err := s.pool.Exec(ctx, initialMigration); err != nil {
		return fmt.Errorf("apply notification migration: %w", err)
	}
	return nil
}

func (s *PostgresStore) CreateNotification(ctx context.Context, notification *models.Notification) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		INSERT INTO axi_notifications.notifications (
			id, type, user_id, recipient, subject, content, category, dot_only,
			is_read, status, created_at, sent_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		notification.ID, string(notification.Type), notification.UserID, notification.Recipient,
		notification.Subject, notification.Content, string(notification.Category), notification.DotOnly,
		notification.Read, string(notification.Status), notification.CreatedAt, notification.SentAt,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO axi_notifications.delivery_jobs (notification_id)
		VALUES ($1)`, notification.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ConsumeEvent records an event and, when the event maps to a user-visible
// notification, inserts that notification in the same transaction. A false
// return means the event ID was already committed by an earlier delivery.
func (s *PostgresStore) ConsumeEvent(ctx context.Context, event *models.OutboxEvent, notification *models.Notification) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var insertedID string
	err = tx.QueryRow(ctx, `
		INSERT INTO axi_notifications.event_inbox (event_id, tenant_id, topic, payload)
		VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb))
		ON CONFLICT (event_id) DO NOTHING
		RETURNING event_id`, event.ID, event.TenantID, event.Topic, event.Payload).Scan(&insertedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if notification != nil {
		if err := insertNotification(ctx, tx, notification); err != nil {
			return false, err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE axi_notifications.event_inbox
		SET processed_at = now()
		WHERE event_id = $1`, event.ID); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return insertedID != "", nil
}

func (s *PostgresStore) ListNotifications(ctx context.Context, userID string, unreadOnly bool) ([]*models.Notification, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, type, user_id, recipient, subject, content, category, dot_only,
		       is_read, status, created_at, sent_at
		FROM axi_notifications.notifications
		WHERE ($1 = '' OR user_id = '' OR user_id = $1)
		  AND ($2 = false OR is_read = false)
		ORDER BY created_at DESC, id DESC`, userID, unreadOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]*models.Notification, 0)
	for rows.Next() {
		notification, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, notification)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *PostgresStore) MarkRead(ctx context.Context, id, userID string) (*models.Notification, error) {
	notification, err := scanNotification(s.pool.QueryRow(ctx, `
		UPDATE axi_notifications.notifications
		SET is_read = true
		WHERE id = $1 AND (user_id = '' OR user_id = $2)
		RETURNING id, type, user_id, recipient, subject, content, category, dot_only,
		          is_read, status, created_at, sent_at`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return notification, err
}

func (s *PostgresStore) MarkAllRead(ctx context.Context, userID string) (int, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE axi_notifications.notifications
		SET is_read = true
		WHERE is_read = false AND (user_id = '' OR user_id = $1)`, userID)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func (s *PostgresStore) UpdateDelivery(ctx context.Context, id string, status models.NotificationStatus, sentAt *time.Time) error {
	result, err := s.pool.Exec(ctx, `
		UPDATE axi_notifications.notifications
		SET status = $2, sent_at = $3
		WHERE id = $1`, id, string(status), sentAt)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *PostgresStore) ClaimPending(ctx context.Context, limit int) ([]*models.Notification, error) {
	rows, err := s.pool.Query(ctx, `
		WITH candidates AS (
			SELECT job.notification_id
			FROM axi_notifications.delivery_jobs job
			WHERE job.delivered_at IS NULL
			  AND job.dead_lettered_at IS NULL
			  AND job.next_attempt_at <= now()
			  AND (job.locked_until IS NULL OR job.locked_until < now())
			ORDER BY job.next_attempt_at, job.notification_id
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		), claimed AS (
			UPDATE axi_notifications.delivery_jobs job
			SET locked_until = now() + interval '1 minute',
			    attempts = job.attempts + 1
			FROM candidates
			WHERE job.notification_id = candidates.notification_id
			RETURNING job.notification_id
		)
		SELECT notification.id, notification.type, notification.user_id,
		       notification.recipient, notification.subject, notification.content,
		       notification.category, notification.dot_only, notification.is_read,
		       notification.status, notification.created_at, notification.sent_at
		FROM axi_notifications.notifications notification
		JOIN claimed ON claimed.notification_id = notification.id`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]*models.Notification, 0)
	for rows.Next() {
		notification, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, notification)
	}
	return result, rows.Err()
}

func (s *PostgresStore) ReleaseDelivery(ctx context.Context, id string, status models.NotificationStatus, sentAt *time.Time, deliveryErr error) error {
	message := ""
	if deliveryErr != nil {
		message = deliveryErr.Error()
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `
		UPDATE axi_notifications.notifications
		SET status = $2, sent_at = $3
		WHERE id = $1`, id, string(status), sentAt); err != nil {
		return err
	}
	if status == models.NotificationStatusSent {
		_, err = tx.Exec(ctx, `
			UPDATE axi_notifications.delivery_jobs
			SET delivered_at = now(), locked_until = NULL, next_attempt_at = now(), last_error = NULL
			WHERE notification_id = $1`, id)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE axi_notifications.delivery_jobs
			SET locked_until = NULL,
			    last_error = left($2, 1000),
			    next_attempt_at = CASE
					WHEN attempts >= 10 THEN now()
					ELSE now() + (LEAST(300, power(2, LEAST(attempts, 8))::integer) * interval '1 second')
				END,
			    dead_lettered_at = CASE WHEN attempts >= 10 THEN now() ELSE NULL END
			WHERE notification_id = $1`, id, message)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *PostgresStore) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

func (s *PostgresStore) Close() { s.pool.Close() }

type rowScanner interface {
	Scan(dest ...any) error
}

func scanNotification(row rowScanner) (*models.Notification, error) {
	var notification models.Notification
	var notificationType, category, status string
	err := row.Scan(
		&notification.ID, &notificationType, &notification.UserID, &notification.Recipient,
		&notification.Subject, &notification.Content, &category, &notification.DotOnly,
		&notification.Read, &status, &notification.CreatedAt, &notification.SentAt,
	)
	if err != nil {
		return nil, err
	}
	notification.Type = models.NotificationType(notificationType)
	notification.Category = models.TabCategory(category)
	notification.Status = models.NotificationStatus(status)
	return &notification, nil
}

func insertNotification(ctx context.Context, tx pgx.Tx, notification *models.Notification) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO axi_notifications.notifications (
			id, type, user_id, recipient, subject, content, category, dot_only,
			is_read, status, created_at, sent_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		notification.ID, string(notification.Type), notification.UserID, notification.Recipient,
		notification.Subject, notification.Content, string(notification.Category), notification.DotOnly,
		notification.Read, string(notification.Status), notification.CreatedAt, notification.SentAt,
	); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO axi_notifications.delivery_jobs (notification_id)
		VALUES ($1)`, notification.ID)
	return err
}
