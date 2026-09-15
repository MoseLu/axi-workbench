//go:build integration

package email

import (
	"os"
	"strings"
	"testing"
	"time"
)

// Run this with Mailpit exposed on 1025, for example after `make docker-up`:
// IDENTITY_MAILPIT_SMTP_REQUIRED=1 go test -tags=integration ./internal/email -run TestMailpitSMTPDelivery
// CI sets REQUIRED=1; a developer without Mailpit gets a visible skip rather
// than an accidental attempt to contact a real QQ/NetEase mailbox.
func TestMailpitSMTPDelivery(t *testing.T) {
	host := environment("IDENTITY_MAILPIT_SMTP_HOST", "127.0.0.1")
	port := environment("IDENTITY_MAILPIT_SMTP_PORT", "1025")
	required := strings.EqualFold(os.Getenv("IDENTITY_MAILPIT_SMTP_REQUIRED"), "1") || strings.EqualFold(os.Getenv("IDENTITY_MAILPIT_SMTP_REQUIRED"), "true")

	sender := SMTPSender{
		Host:          host,
		Port:          port,
		From:          "identity-test@axi.local",
		AllowInsecure: true, // Mailpit is a local test transport, never production SMTP.
		Timeout:       3 * time.Second,
	}
	err := sender.Send(Message{
		To:      "verification-test@axi.local",
		Subject: "Axi Mailpit integration",
		Text:    "one-time verification transport smoke",
	})
	if err != nil && !required {
		t.Skipf("Mailpit is unavailable at %s:%s: %v", host, port, err)
	}
	if err != nil {
		t.Fatalf("deliver message through Mailpit: %v", err)
	}
}

func environment(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
