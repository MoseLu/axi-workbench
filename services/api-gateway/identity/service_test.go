package identity

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
)

type fakeOIDCClient struct {
	exchangeCalls int
}

func (f *fakeOIDCClient) AuthorizationURL(state, _, _ string) string {
	return "https://id.axi.test/authorize?state=" + url.QueryEscape(state)
}

func (f *fakeOIDCClient) Exchange(_ context.Context, code string, transaction authorizationTransaction) (browserSession, error) {
	f.exchangeCalls++
	if code != "valid-code" || transaction.Nonce == "" || transaction.CodeVerifier == "" {
		return browserSession{}, ErrUnauthorized
	}
	return browserSession{
		Principal:    Principal{Subject: "zitadel-subject", Email: "team@axi.test"},
		AccessToken:  "server-side-only-access-token",
		RefreshToken: "server-side-only-refresh-token",
		ExpiresAt:    time.Now().Add(time.Hour),
	}, nil
}

func (f *fakeOIDCClient) VerifyBearer(_ context.Context, token string) (Principal, error) {
	if token != "valid-bearer" {
		return Principal{}, ErrUnauthorized
	}
	return Principal{Subject: "zitadel-bearer"}, nil
}

func TestOIDCStateIsSingleUseAndBrowserOnlyGetsOpaqueSession(t *testing.T) {
	now := time.Date(2026, 8, 7, 1, 0, 0, 0, time.UTC)
	client := &fakeOIDCClient{}
	cfg := config.IdentityConfig{
		ClientID:          "axi-web",
		SessionCookieName: "axi_session",
		SessionTTL:        2 * time.Hour,
		AllowedReturnURLs: []string{"https://web.axi.test/auth/callback"},
	}
	service := NewForTest(cfg, NewMemoryRecordStore(func() time.Time { return now }), client, func() time.Time { return now })

	location, err := service.Begin(context.Background(), "https://web.axi.test/auth/callback")
	if err != nil {
		t.Fatalf("begin OIDC: %v", err)
	}
	authorizationURL, err := url.Parse(location)
	if err != nil {
		t.Fatalf("parse authorization URL: %v", err)
	}
	state := authorizationURL.Query().Get("state")
	if state == "" {
		t.Fatal("OIDC state missing from authorization URL")
	}

	sessionID, session, returnTo, err := service.Complete(context.Background(), state, "valid-code")
	if err != nil {
		t.Fatalf("complete OIDC: %v", err)
	}
	if sessionID == "" || session.Principal.Subject != "zitadel-subject" || returnTo != "https://web.axi.test/auth/callback" {
		t.Fatalf("unexpected OIDC completion: id=%q session=%#v return=%q", sessionID, session, returnTo)
	}
	if _, _, _, err := service.Complete(context.Background(), state, "valid-code"); err != ErrUnauthorized {
		t.Fatalf("replayed state error = %v, want %v", err, ErrUnauthorized)
	}
	if client.exchangeCalls != 1 {
		t.Fatalf("OIDC exchange calls = %d, want 1", client.exchangeCalls)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: cfg.SessionCookieName, Value: sessionID})
	principal, err := service.Authenticate(context.Background(), request)
	if err != nil || principal.Subject != "zitadel-subject" {
		t.Fatalf("session authentication = %#v, %v", principal, err)
	}
	if err := service.Logout(context.Background(), request); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := service.Authenticate(context.Background(), request); err != ErrUnauthorized {
		t.Fatalf("logged out session error = %v, want %v", err, ErrUnauthorized)
	}
}

func TestOIDCReturnURLRejectsOpenRedirect(t *testing.T) {
	service := NewForTest(config.IdentityConfig{SessionTTL: time.Hour}, NewMemoryRecordStore(nil), &fakeOIDCClient{}, nil)
	if _, err := service.Begin(context.Background(), "//evil.example"); err == nil {
		t.Fatal("open redirect was accepted")
	}
}

func TestAccessTokenScopesMustContainEveryRequiredScope(t *testing.T) {
	if !claimsHaveRequiredScopes(map[string]any{"scope": "openid axi.api"}, []string{"axi.api"}) {
		t.Fatal("space-delimited scope claim was rejected")
	}
	if !claimsHaveRequiredScopes(map[string]any{"permissions": []any{"axi.api", "axi.admin"}}, []string{"axi.api", "axi.admin"}) {
		t.Fatal("array permission claims were rejected")
	}
	if claimsHaveRequiredScopes(map[string]any{"scope": "openid profile"}, []string{"axi.api"}) {
		t.Fatal("missing API scope was accepted")
	}
}

func TestEmailLoginPrincipalIsFixedOwnerAndCanonicalSubject(t *testing.T) {
	service := NewForTest(config.IdentityConfig{
		SessionTTL:           time.Hour,
		EmailLoginOwnerEmail: "owner@example.com",
		EmailLoginSubject:    "owner-subject",
	}, NewMemoryRecordStore(nil), nil, nil)
	principal, err := service.EmailLoginPrincipal(" OWNER@example.com ")
	if err != nil || principal.Subject != "owner-subject" || principal.Email != "owner@example.com" {
		t.Fatalf("owner principal = %#v, %v", principal, err)
	}
	if _, err := service.EmailLoginPrincipal("other@example.com"); err != ErrUnauthorized {
		t.Fatalf("non-owner email error = %v, want %v", err, ErrUnauthorized)
	}
	if _, err := service.EmailLoginPrincipal("owner@example.com"); err != nil {
		t.Fatalf("configured owner rejected: %v", err)
	}
}

func TestEmailLoginPrincipalFailsClosedWhenNotConfigured(t *testing.T) {
	service := NewForTest(config.IdentityConfig{SessionTTL: time.Hour}, NewMemoryRecordStore(nil), nil, nil)
	if _, err := service.EmailLoginPrincipal("owner@example.com"); err != ErrUnavailable {
		t.Fatalf("unconfigured email login error = %v, want %v", err, ErrUnavailable)
	}
}
