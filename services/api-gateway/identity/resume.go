package identity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	defaultResumeCookieName = "axi_resume"
	defaultResumeTTL        = 10 * 24 * time.Hour
)

type resumeTicket struct {
	Principal  Principal `json:"principal"`
	DeviceHash string    `json:"deviceHash"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

func (s *Service) resumeCookieName() string {
	name := strings.TrimSpace(s.config.ResumeCookieName)
	if name == "" {
		return defaultResumeCookieName
	}
	return name
}

func (s *Service) resumeTTL() time.Duration {
	if s.config.ResumeTicketTTL > 0 {
		return s.config.ResumeTicketTTL
	}
	return defaultResumeTTL
}

func resumeKey(id string) string { return "axi:resume:" + id }

func hashDeviceID(deviceID string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(deviceID)))
	return hex.EncodeToString(sum[:])
}

func normalizeDeviceID(deviceID string) (string, error) {
	value := strings.TrimSpace(deviceID)
	if value == "" || len(value) > 128 {
		return "", ErrUnauthorized
	}
	return value, nil
}

// IssueResumeTicket stores a device-bound resume ticket and returns the opaque
// cookie value. The raw device id is hashed before persistence.
func (s *Service) IssueResumeTicket(ctx context.Context, principal Principal, deviceID string) (string, error) {
	principal.Subject = strings.TrimSpace(principal.Subject)
	principal.Email = strings.TrimSpace(principal.Email)
	principal.Name = strings.TrimSpace(principal.Name)
	if principal.Subject == "" {
		return "", ErrUnauthorized
	}
	var err error
	principal, err = s.ResolvePrincipalProfile(ctx, principal)
	if err != nil {
		return "", err
	}
	normalized, err := normalizeDeviceID(deviceID)
	if err != nil {
		return "", err
	}
	ticketID, err := opaqueValue()
	if err != nil {
		return "", fmt.Errorf("generate resume ticket: %w", err)
	}
	now := s.now()
	ttl := s.resumeTTL()
	record, err := json.Marshal(resumeTicket{
		Principal:  principal,
		DeviceHash: hashDeviceID(normalized),
		ExpiresAt:  now.Add(ttl),
	})
	if err != nil {
		return "", fmt.Errorf("encode resume ticket: %w", err)
	}
	if err := s.records.Set(ctx, resumeKey(ticketID), record, ttl); err != nil {
		return "", fmt.Errorf("%w: persist resume ticket", ErrSessionStoreUnavailable)
	}
	return ticketID, nil
}

func (s *Service) loadResumeTicket(ctx context.Context, ticketID, deviceID string) (resumeTicket, error) {
	normalized, err := normalizeDeviceID(deviceID)
	if err != nil {
		return resumeTicket{}, err
	}
	ticketID = strings.TrimSpace(ticketID)
	if ticketID == "" {
		return resumeTicket{}, ErrUnauthorized
	}
	raw, err := s.records.Get(ctx, resumeKey(ticketID))
	if err != nil {
		if errors.Is(err, ErrRecordNotFound) {
			return resumeTicket{}, ErrUnauthorized
		}
		return resumeTicket{}, ErrSessionStoreUnavailable
	}
	var ticket resumeTicket
	if err := json.Unmarshal(raw, &ticket); err != nil {
		return resumeTicket{}, ErrUnauthorized
	}
	if ticket.DeviceHash != hashDeviceID(normalized) || ticket.Principal.Subject == "" {
		return resumeTicket{}, ErrUnauthorized
	}
	if !ticket.ExpiresAt.IsZero() && !s.now().Before(ticket.ExpiresAt) {
		_ = s.records.Delete(ctx, resumeKey(ticketID))
		return resumeTicket{}, ErrUnauthorized
	}
	return ticket, nil
}

// PeekResumeTicket reports the bound principal without issuing a session.
func (s *Service) PeekResumeTicket(ctx context.Context, ticketID, deviceID string) (Principal, error) {
	ticket, err := s.loadResumeTicket(ctx, ticketID, deviceID)
	if err != nil {
		return Principal{}, err
	}
	return s.ResolvePrincipalProfile(ctx, ticket.Principal)
}

// RedeemResumeTicket exchanges a still-valid device ticket for a browser session
// and refreshes the ticket TTL on the same device without rotating the cookie.
func (s *Service) RedeemResumeTicket(ctx context.Context, ticketID, deviceID string) (string, Principal, error) {
	ticket, err := s.loadResumeTicket(ctx, ticketID, deviceID)
	if err != nil {
		return "", Principal{}, err
	}
	ticket.Principal, err = s.ResolvePrincipalProfile(ctx, ticket.Principal)
	if err != nil {
		return "", Principal{}, err
	}
	sessionID, err := s.IssuePrincipalSession(ctx, ticket.Principal)
	if err != nil {
		return "", Principal{}, err
	}
	ttl := s.resumeTTL()
	ticket.ExpiresAt = s.now().Add(ttl)
	record, err := json.Marshal(ticket)
	if err == nil {
		_ = s.records.Set(ctx, resumeKey(strings.TrimSpace(ticketID)), record, ttl)
	}
	return sessionID, ticket.Principal, nil
}

func (s *Service) SetResumeCookie(response http.ResponseWriter, ticketID string) {
	http.SetCookie(response, &http.Cookie{
		Name:     s.resumeCookieName(),
		Value:    ticketID,
		Path:     "/",
		Domain:   s.config.SessionCookieDomain,
		MaxAge:   int(s.resumeTTL().Seconds()),
		HttpOnly: true,
		Secure:   s.config.SessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) ClearResumeCookie(response http.ResponseWriter) {
	http.SetCookie(response, &http.Cookie{
		Name:     s.resumeCookieName(),
		Value:    "",
		Path:     "/",
		Domain:   s.config.SessionCookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.config.SessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) ResumeTicketFromRequest(request *http.Request) string {
	cookie, err := request.Cookie(s.resumeCookieName())
	if err != nil || cookie.Value == "" {
		return ""
	}
	return cookie.Value
}

func DeviceIDFromRequest(request *http.Request) string {
	return strings.TrimSpace(request.Header.Get("X-Axi-Device-Id"))
}
