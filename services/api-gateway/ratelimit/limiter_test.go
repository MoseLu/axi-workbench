package ratelimit

import (
	"context"
	"testing"
	"time"
)

func TestMemoryLimiterResetsAtMinuteBoundary(t *testing.T) {
	now := time.Date(2026, 8, 7, 1, 0, 30, 0, time.UTC)
	limiter := NewMemory(1, func() time.Time { return now })
	first, err := limiter.Allow(context.Background(), "client")
	if err != nil || !first.Allowed || first.Remaining != 0 {
		t.Fatalf("first decision = %#v, %v", first, err)
	}
	second, _ := limiter.Allow(context.Background(), "client")
	if second.Allowed {
		t.Fatal("second request inside the window was allowed")
	}
	now = now.Add(31 * time.Second)
	third, _ := limiter.Allow(context.Background(), "client")
	if !third.Allowed {
		t.Fatal("request after minute boundary was not reset")
	}
}
