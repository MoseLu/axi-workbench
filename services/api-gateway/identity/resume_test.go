package identity

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestResumeTicketIsBoundToDeviceAndCanIssueASession(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionCookieName = "axi_session"
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	principal := Principal{Subject: "owner-subject", Email: "owner@example.test", Name: "Owner"}

	ticketID, err := service.IssueResumeTicket(context.Background(), principal, "device-alpha")
	if err != nil || ticketID == "" {
		t.Fatalf("issue resume ticket: id=%q err=%v", ticketID, err)
	}

	peeked, err := service.PeekResumeTicket(context.Background(), ticketID, "device-alpha")
	if err != nil {
		t.Fatalf("peek resume ticket: %v", err)
	}
	if peeked.Subject != principal.Subject || peeked.Email != principal.Email {
		t.Fatalf("peeked principal = %#v", peeked)
	}
	if _, err := service.PeekResumeTicket(context.Background(), ticketID, "device-other"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("foreign device peek error = %v, want ErrUnauthorized", err)
	}

	sessionID, redeemed, err := service.RedeemResumeTicket(context.Background(), ticketID, "device-alpha")
	if err != nil {
		t.Fatalf("redeem resume ticket: %v", err)
	}
	if sessionID == "" || redeemed.Subject != principal.Subject {
		t.Fatalf("redeemed session=%q principal=%#v", sessionID, redeemed)
	}
	restored, _, err := service.RestoreSession(context.Background(), sessionRequest(cfg.SessionCookieName, sessionID))
	if err != nil || restored.Subject != principal.Subject {
		t.Fatalf("restored session after resume: %#v / %v", restored, err)
	}
}

func TestExpiredResumeTicketCannotRedeem(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 9, 12, 12, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.ResumeTicketTTL = time.Hour
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	ticketID, err := service.IssueResumeTicket(context.Background(), Principal{Subject: "owner-subject", Email: "owner@example.test"}, "device-alpha")
	if err != nil {
		t.Fatalf("issue resume ticket: %v", err)
	}
	clock.now = clock.now.Add(2 * time.Hour)
	if _, err := service.PeekResumeTicket(context.Background(), ticketID, "device-alpha"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expired peek error = %v, want ErrUnauthorized", err)
	}
}

func TestResumeCookieRoundTrip(t *testing.T) {
	cfg := emailSessionConfig()
	service := NewForTest(cfg, NewMemoryRecordStore(nil), nil, nil)
	recorder := httptest.NewRecorder()
	service.SetResumeCookie(recorder, "ticket-value")
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "axi_resume" || cookies[0].Value != "ticket-value" || !cookies[0].HttpOnly {
		t.Fatalf("resume cookie = %#v", cookies)
	}
	request, _ := http.NewRequest(http.MethodGet, "/", nil)
	request.AddCookie(cookies[0])
	if got := service.ResumeTicketFromRequest(request); got != "ticket-value" {
		t.Fatalf("resume cookie = %q", got)
	}
}
