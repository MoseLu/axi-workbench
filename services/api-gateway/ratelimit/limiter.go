package ratelimit

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Decision struct {
	Allowed   bool
	Remaining int
	ResetAt   time.Time
}

type Limiter interface {
	Allow(context.Context, string) (Decision, error)
	Ping(context.Context) error
	Close() error
}

type memoryWindow struct {
	count   int
	resetAt time.Time
}

type MemoryLimiter struct {
	mu      sync.Mutex
	limit   int
	windows map[string]memoryWindow
	now     func() time.Time
}

func NewMemory(limit int, now func() time.Time) *MemoryLimiter {
	if now == nil {
		now = time.Now
	}
	return &MemoryLimiter{limit: limit, windows: make(map[string]memoryWindow), now: now}
}

func (l *MemoryLimiter) Allow(_ context.Context, key string) (Decision, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	window := l.windows[key]
	if window.resetAt.IsZero() || !now.Before(window.resetAt) {
		window = memoryWindow{resetAt: now.Truncate(time.Minute).Add(time.Minute)}
	}
	window.count++
	l.windows[key] = window
	return Decision{Allowed: window.count <= l.limit, Remaining: max(l.limit-window.count, 0), ResetAt: window.resetAt}, nil
}

func (l *MemoryLimiter) Ping(context.Context) error { return nil }
func (l *MemoryLimiter) Close() error               { return nil }

type RedisLimiter struct {
	client *redis.Client
	limit  int
	now    func() time.Time
}

func NewRedis(redisURL string, limit int) (*RedisLimiter, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &RedisLimiter{client: redis.NewClient(options), limit: limit, now: time.Now}, nil
}

func (l *RedisLimiter) Allow(ctx context.Context, key string) (Decision, error) {
	now := l.now()
	resetAt := now.Truncate(time.Minute).Add(time.Minute)
	redisKey := fmt.Sprintf("axi:ratelimit:%s:%d", key, now.Unix()/60)
	pipeline := l.client.TxPipeline()
	count := pipeline.Incr(ctx, redisKey)
	pipeline.ExpireAt(ctx, redisKey, resetAt.Add(time.Second))
	if _, err := pipeline.Exec(ctx); err != nil {
		return Decision{}, err
	}
	current, err := count.Result()
	if err != nil {
		return Decision{}, err
	}
	return Decision{Allowed: current <= int64(l.limit), Remaining: max(l.limit-int(current), 0), ResetAt: resetAt}, nil
}

func (l *RedisLimiter) Ping(ctx context.Context) error { return l.client.Ping(ctx).Err() }
func (l *RedisLimiter) Close() error                   { return l.client.Close() }

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}
