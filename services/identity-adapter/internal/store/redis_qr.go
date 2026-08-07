package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/model"
	"github.com/redis/go-redis/v9"
)

const (
	redisQRKeyPrefix        = "axi:identity:qr:"
	redisQRExpiredRetention = 5 * time.Minute
	redisQRMutationRetries  = 5
)

// RedisQRStore keeps only short-lived QR transactions in Redis. The opaque
// QR, poll and resume credentials are hashed before they reach this layer.
// Email-verification and EPS mapping records stay in the durable PostgreSQL
// store because they have a longer lifecycle and audit value.
type RedisQRStore struct {
	client    *redis.Client
	durable   Store
	now       func() time.Time
	retention time.Duration
}

func NewRedisQR(ctx context.Context, redisURL string, durable Store, now func() time.Time) (*RedisQRStore, error) {
	if durable == nil {
		return nil, fmt.Errorf("durable identity store is required")
	}
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse identity redis URL: %w", err)
	}
	client := redis.NewClient(options)
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("ping identity redis: %w", err)
	}
	if now == nil {
		now = time.Now
	}
	return &RedisQRStore{
		client:    client,
		durable:   durable,
		now:       now,
		retention: redisQRExpiredRetention,
	}, nil
}

func (s *RedisQRStore) CreateQRTransaction(ctx context.Context, transaction model.QRTransaction) error {
	encoded, err := json.Marshal(transaction)
	if err != nil {
		return fmt.Errorf("encode QR transaction: %w", err)
	}
	ttl := s.ttl(transaction)
	if ttl <= s.retention {
		return ErrExpired
	}
	created, err := s.client.SetNX(ctx, s.qrKey(transaction.ID), encoded, ttl).Result()
	if err != nil {
		return fmt.Errorf("create QR transaction in redis: %w", err)
	}
	if !created {
		return ErrInvalidState
	}
	return nil
}

func (s *RedisQRStore) GetQRTransaction(ctx context.Context, id string) (model.QRTransaction, error) {
	return s.getQRTransaction(ctx, s.client, id)
}

func (s *RedisQRStore) ApproveQRTransaction(ctx context.Context, id, ticketHash, subject string) (model.QRTransaction, error) {
	return s.mutateQRTransaction(ctx, id, func(transaction *model.QRTransaction) error {
		if transaction.EffectiveStatus(s.now()) == model.QRExpired {
			return ErrExpired
		}
		if transaction.Status != model.QRPending || transaction.TicketHash != ticketHash {
			return ErrInvalidState
		}
		transaction.Status = model.QRApproved
		transaction.Subject = subject
		transaction.UpdatedAt = s.now().UTC()
		return nil
	})
}

func (s *RedisQRStore) BeginQRResume(ctx context.Context, id, pollTokenHash, resumeTokenHash string) (model.QRTransaction, error) {
	return s.mutateQRTransaction(ctx, id, func(transaction *model.QRTransaction) error {
		if transaction.EffectiveStatus(s.now()) == model.QRExpired {
			return ErrExpired
		}
		if transaction.Status != model.QRApproved || transaction.PollTokenHash != pollTokenHash {
			return ErrInvalidState
		}
		transaction.Status = model.QRResuming
		transaction.ResumeTokenHash = resumeTokenHash
		transaction.UpdatedAt = s.now().UTC()
		return nil
	})
}

func (s *RedisQRStore) ConsumeQRResume(ctx context.Context, id, resumeTokenHash string) (model.QRTransaction, error) {
	return s.mutateQRTransaction(ctx, id, func(transaction *model.QRTransaction) error {
		if transaction.EffectiveStatus(s.now()) == model.QRExpired {
			return ErrExpired
		}
		if transaction.Status == model.QRConsumed {
			return ErrAlreadyConsumed
		}
		if transaction.Status != model.QRResuming || transaction.ResumeTokenHash != resumeTokenHash {
			return ErrInvalidState
		}
		transaction.Status = model.QRConsumed
		transaction.ResumeTokenHash = ""
		transaction.UpdatedAt = s.now().UTC()
		return nil
	})
}

func (s *RedisQRStore) CreateEmailVerification(ctx context.Context, verification model.EmailVerification) error {
	return s.durable.CreateEmailVerification(ctx, verification)
}

func (s *RedisQRStore) ConsumeEmailVerification(ctx context.Context, tokenHash string) (model.EmailVerification, error) {
	return s.durable.ConsumeEmailVerification(ctx, tokenHash)
}

func (s *RedisQRStore) UpsertEPSIdentityLink(ctx context.Context, link model.EPSIdentityLink) (model.EPSIdentityLink, error) {
	return s.durable.UpsertEPSIdentityLink(ctx, link)
}

func (s *RedisQRStore) GetEPSIdentityLink(ctx context.Context, provider, subject string) (model.EPSIdentityLink, error) {
	return s.durable.GetEPSIdentityLink(ctx, provider, subject)
}

func (s *RedisQRStore) Ping(ctx context.Context) error {
	return errors.Join(s.client.Ping(ctx).Err(), s.durable.Ping(ctx))
}

func (s *RedisQRStore) Close() {
	_ = s.client.Close()
	s.durable.Close()
}

type redisStringGetter interface {
	Get(context.Context, string) *redis.StringCmd
}

func (s *RedisQRStore) getQRTransaction(ctx context.Context, client redisStringGetter, id string) (model.QRTransaction, error) {
	raw, err := client.Get(ctx, s.qrKey(id)).Result()
	if errors.Is(err, redis.Nil) {
		return model.QRTransaction{}, ErrNotFound
	}
	if err != nil {
		return model.QRTransaction{}, fmt.Errorf("read QR transaction from redis: %w", err)
	}
	var transaction model.QRTransaction
	if err := json.Unmarshal([]byte(raw), &transaction); err != nil {
		return model.QRTransaction{}, fmt.Errorf("decode QR transaction from redis: %w", err)
	}
	return transaction, nil
}

func (s *RedisQRStore) mutateQRTransaction(ctx context.Context, id string, mutate func(*model.QRTransaction) error) (model.QRTransaction, error) {
	key := s.qrKey(id)
	for attempt := 0; attempt < redisQRMutationRetries; attempt++ {
		var result model.QRTransaction
		err := s.client.Watch(ctx, func(tx *redis.Tx) error {
			transaction, err := s.getQRTransaction(ctx, tx, id)
			if err != nil {
				return err
			}
			if err := mutate(&transaction); err != nil {
				return err
			}
			encoded, err := json.Marshal(transaction)
			if err != nil {
				return fmt.Errorf("encode QR transaction: %w", err)
			}
			if _, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Set(ctx, key, encoded, s.ttl(transaction))
				return nil
			}); err != nil {
				return err
			}
			result = transaction
			return nil
		}, key)
		if errors.Is(err, redis.TxFailedErr) {
			continue
		}
		if err != nil {
			return model.QRTransaction{}, err
		}
		return result, nil
	}
	return model.QRTransaction{}, ErrInvalidState
}

func (s *RedisQRStore) qrKey(id string) string { return redisQRKeyPrefix + id }

func (s *RedisQRStore) ttl(transaction model.QRTransaction) time.Duration {
	return transaction.ExpiresAt.Sub(s.now()) + s.retention
}
