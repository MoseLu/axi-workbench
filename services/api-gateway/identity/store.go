package identity

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrRecordNotFound = errors.New("gateway identity record not found")

// RecordStore is used for opaque browser sessions and single-use OIDC state.
// Raw OAuth tokens remain server-side in this store and never appear in API
// responses or browser storage.
type RecordStore interface {
	Set(context.Context, string, []byte, time.Duration) error
	Get(context.Context, string) ([]byte, error)
	CompareAndSet(context.Context, string, []byte, []byte, time.Duration) error
	Rotate(context.Context, string, []byte, string, []byte, time.Duration) error
	Delete(context.Context, string) error
	Ping(context.Context) error
	Close() error
}

type memoryRecord struct {
	value     []byte
	expiresAt time.Time
}

type MemoryRecordStore struct {
	mu      sync.Mutex
	records map[string]memoryRecord
	now     func() time.Time
}

func NewMemoryRecordStore(now func() time.Time) *MemoryRecordStore {
	if now == nil {
		now = time.Now
	}
	return &MemoryRecordStore{records: make(map[string]memoryRecord), now: now}
}

func (s *MemoryRecordStore) Set(_ context.Context, key string, value []byte, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.records[key] = memoryRecord{value: append([]byte(nil), value...), expiresAt: s.now().Add(ttl)}
	return nil
}

func (s *MemoryRecordStore) Get(_ context.Context, key string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, exists := s.records[key]
	if !exists || !s.now().Before(record.expiresAt) {
		delete(s.records, key)
		return nil, ErrRecordNotFound
	}
	return append([]byte(nil), record.value...), nil
}

func (s *MemoryRecordStore) CompareAndSet(_ context.Context, key string, expected, next []byte, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	record, exists := s.records[key]
	if !exists || !now.Before(record.expiresAt) {
		delete(s.records, key)
		return ErrRecordNotFound
	}
	if !bytes.Equal(record.value, expected) {
		return ErrRecordNotFound
	}
	s.records[key] = memoryRecord{value: append([]byte(nil), next...), expiresAt: now.Add(ttl)}
	return nil
}

func (s *MemoryRecordStore) Rotate(_ context.Context, oldKey string, expected []byte, newKey string, newValue []byte, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	record, exists := s.records[oldKey]
	if !exists || !now.Before(record.expiresAt) {
		delete(s.records, oldKey)
		return ErrRecordNotFound
	}
	if !bytes.Equal(record.value, expected) {
		return ErrRecordNotFound
	}
	s.records[newKey] = memoryRecord{value: append([]byte(nil), newValue...), expiresAt: now.Add(ttl)}
	delete(s.records, oldKey)
	return nil
}

func (s *MemoryRecordStore) Delete(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.records, key)
	return nil
}

func (s *MemoryRecordStore) Ping(context.Context) error { return nil }
func (s *MemoryRecordStore) Close() error               { return nil }

type RedisRecordStore struct {
	client *redis.Client
}

func NewRedisRecordStore(redisURL string) (*RedisRecordStore, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &RedisRecordStore{client: redis.NewClient(options)}, nil
}

func (s *RedisRecordStore) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	return s.client.Set(ctx, key, append([]byte(nil), value...), ttl).Err()
}

func (s *RedisRecordStore) Get(ctx context.Context, key string) ([]byte, error) {
	value, err := s.client.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrRecordNotFound
	}
	if err != nil {
		return nil, err
	}
	return append([]byte(nil), value...), nil
}

const compareAndSetRecordScript = `
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`

func (s *RedisRecordStore) CompareAndSet(ctx context.Context, key string, expected, next []byte, ttl time.Duration) error {
	result, err := s.client.Eval(ctx, compareAndSetRecordScript, []string{key}, append([]byte(nil), expected...), append([]byte(nil), next...), ttl.Milliseconds()).Int()
	if err != nil {
		return err
	}
	if result == 0 {
		return ErrRecordNotFound
	}
	return nil
}

const rotateRecordScript = `
local current = redis.call('GET', KEYS[1])
if not current or current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
redis.call('DEL', KEYS[1])
return 1
`

func (s *RedisRecordStore) Rotate(ctx context.Context, oldKey string, expected []byte, newKey string, newValue []byte, ttl time.Duration) error {
	result, err := s.client.Eval(ctx, rotateRecordScript, []string{oldKey, newKey}, append([]byte(nil), expected...), append([]byte(nil), newValue...), ttl.Milliseconds()).Int()
	if err != nil {
		return err
	}
	if result == 0 {
		return ErrRecordNotFound
	}
	return nil
}

func (s *RedisRecordStore) Delete(ctx context.Context, key string) error {
	return s.client.Del(ctx, key).Err()
}

func (s *RedisRecordStore) Ping(ctx context.Context) error { return s.client.Ping(ctx).Err() }
func (s *RedisRecordStore) Close() error                   { return s.client.Close() }
