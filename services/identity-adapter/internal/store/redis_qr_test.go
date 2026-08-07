package store

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/axi-workbench/identity-adapter/internal/model"
)

func TestRedisQRStoreConsumesResumeOnlyOnce(t *testing.T) {
	redisServer := miniredis.RunT(t)
	now := time.Date(2026, time.August, 7, 12, 0, 0, 0, time.UTC)
	persistence, err := NewRedisQR(context.Background(), "redis://"+redisServer.Addr()+"/1", NewMemory(func() time.Time { return now }), func() time.Time { return now })
	if err != nil {
		t.Fatalf("new Redis QR store: %v", err)
	}
	defer persistence.Close()

	transaction := model.QRTransaction{
		ID:                  "qr-1",
		TicketHash:          "ticket-hash",
		PollTokenHash:       "poll-hash",
		ClientID:            "axi-web",
		RedirectURI:         "https://web.axi.example.com/auth/callback",
		CodeChallenge:       "challenge",
		CodeChallengeMethod: "S256",
		Status:              model.QRPending,
		ExpiresAt:           now.Add(time.Minute),
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if err := persistence.CreateQRTransaction(context.Background(), transaction); err != nil {
		t.Fatalf("create QR transaction: %v", err)
	}
	if _, err := persistence.ApproveQRTransaction(context.Background(), transaction.ID, "ticket-hash", "zitadel-user"); err != nil {
		t.Fatalf("approve QR transaction: %v", err)
	}
	if _, err := persistence.BeginQRResume(context.Background(), transaction.ID, "poll-hash", "resume-hash"); err != nil {
		t.Fatalf("begin QR resume: %v", err)
	}
	consumed, err := persistence.ConsumeQRResume(context.Background(), transaction.ID, "resume-hash")
	if err != nil {
		t.Fatalf("consume QR resume: %v", err)
	}
	if consumed.Status != model.QRConsumed || consumed.ResumeTokenHash != "" {
		t.Fatalf("consumed transaction = %#v", consumed)
	}
	if _, err := persistence.ConsumeQRResume(context.Background(), transaction.ID, "resume-hash"); err != ErrAlreadyConsumed {
		t.Fatalf("replay consume error = %v, want %v", err, ErrAlreadyConsumed)
	}
}

func TestRedisQRStoreRejectsExpiredApproval(t *testing.T) {
	redisServer := miniredis.RunT(t)
	now := time.Date(2026, time.August, 7, 12, 0, 0, 0, time.UTC)
	persistence, err := NewRedisQR(context.Background(), "redis://"+redisServer.Addr()+"/1", NewMemory(func() time.Time { return now }), func() time.Time { return now })
	if err != nil {
		t.Fatalf("new Redis QR store: %v", err)
	}
	defer persistence.Close()

	transaction := model.QRTransaction{
		ID:                  "qr-expired",
		TicketHash:          "ticket-hash",
		PollTokenHash:       "poll-hash",
		ClientID:            "axi-web",
		RedirectURI:         "https://web.axi.example.com/auth/callback",
		CodeChallenge:       "challenge",
		CodeChallengeMethod: "S256",
		Status:              model.QRPending,
		ExpiresAt:           now.Add(time.Second),
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if err := persistence.CreateQRTransaction(context.Background(), transaction); err != nil {
		t.Fatalf("create QR transaction: %v", err)
	}
	now = now.Add(2 * time.Second)
	if _, err := persistence.ApproveQRTransaction(context.Background(), transaction.ID, "ticket-hash", "zitadel-user"); err != ErrExpired {
		t.Fatalf("expired approval error = %v, want %v", err, ErrExpired)
	}
}
