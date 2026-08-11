package identity

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
)

type fakeOIDCClient struct {
	exchangeCalls  int
	tokenExpiresAt time.Time
}

func (f *fakeOIDCClient) AuthorizationURL(state, _, _ string) string {
	return "https://id.axi.test/authorize?state=" + url.QueryEscape(state)
}

func (f *fakeOIDCClient) Exchange(_ context.Context, code string, transaction authorizationTransaction) (browserSession, error) {
	f.exchangeCalls++
	if code != "valid-code" || transaction.Nonce == "" || transaction.CodeVerifier == "" {
		return browserSession{}, ErrUnauthorized
	}
	expiresAt := f.tokenExpiresAt
	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(time.Hour)
	}
	return browserSession{
		Principal:    Principal{Subject: "zitadel-subject", Email: "team@axi.test"},
		AccessToken:  "server-side-only-access-token",
		RefreshToken: "server-side-only-refresh-token",
		ExpiresAt:    expiresAt,
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

type testClock struct {
	now time.Time
}

func (c *testClock) Now() time.Time {
	return c.now
}

func (c *testClock) Advance(duration time.Duration) {
	c.now = c.now.Add(duration)
}

func rotateRecord(t *testing.T, store RecordStore, oldKey, newKey string, value []byte, ttl time.Duration) error {
	t.Helper()
	return store.Rotate(context.Background(), oldKey, newKey, value, ttl)
}

func restoreSession(t *testing.T, service *Service, request *http.Request) (Principal, string, error) {
	t.Helper()
	return service.RestoreSession(context.Background(), request)
}

func sessionRequest(cookieName, sessionID string) *http.Request {
	request := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	request.AddCookie(&http.Cookie{Name: cookieName, Value: sessionID})
	return request
}

func storedSession(t *testing.T, store RecordStore, sessionID string) browserSession {
	t.Helper()
	record, err := store.Get(context.Background(), sessionKey(sessionID))
	if err != nil {
		t.Fatalf("load stored session: %v", err)
	}
	var session browserSession
	if err := json.Unmarshal(record, &session); err != nil {
		t.Fatalf("decode stored session: %v", err)
	}
	return session
}

func emailSessionConfig() config.IdentityConfig {
	return config.IdentityConfig{
		SessionCookieName:    "axi_session",
		SessionTTL:           8 * time.Hour,
		SessionIdleTTL:       time.Hour,
		SessionAbsoluteTTL:   4 * time.Hour,
		EmailLoginOwnerEmail: "owner@axi.test",
		EmailLoginSubject:    "owner-subject",
	}
}

func TestMemoryRecordStoreRotateAtomicallyReplacesOnlyLiveOldRecord(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 9, 0, 0, 0, time.UTC)}
	store := NewMemoryRecordStore(clock.Now)
	oldValue := []byte("old-value")
	if err := store.Set(context.Background(), "old", oldValue, time.Hour); err != nil {
		t.Fatalf("set old record: %v", err)
	}
	oldValue[0] = 'x'

	newValue := []byte("new-value")
	if err := rotateRecord(t, store, "old", "new", newValue, 30*time.Minute); err != nil {
		t.Fatalf("rotate record: %v", err)
	}
	newValue[0] = 'x'
	if _, err := store.Get(context.Background(), "old"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("old record error = %v, want ErrRecordNotFound", err)
	}
	got, err := store.Get(context.Background(), "new")
	if err != nil {
		t.Fatalf("get rotated record: %v", err)
	}
	if string(got) != "new-value" {
		t.Fatalf("rotated value = %q, want copied new value", got)
	}

	if err := rotateRecord(t, store, "missing", "absent-new", []byte("should-not-write"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("missing old record error = %v, want ErrRecordNotFound", err)
	}
	if _, err := store.Get(context.Background(), "absent-new"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("new record after missing-old rotate error = %v, want ErrRecordNotFound", err)
	}

	if err := store.Set(context.Background(), "expired", []byte("expired-value"), time.Minute); err != nil {
		t.Fatalf("set expiring record: %v", err)
	}
	clock.Advance(time.Minute)
	if err := rotateRecord(t, store, "expired", "expired-new", []byte("should-not-write"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expired old record error = %v, want ErrRecordNotFound", err)
	}
	if _, err := store.Get(context.Background(), "expired-new"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("new record after expired-old rotate error = %v, want ErrRecordNotFound", err)
	}
}

func TestOIDCSessionPolicyIgnoresShortOIDCTokenExpiry(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 10, 0, 0, 0, time.UTC)}
	client := &fakeOIDCClient{tokenExpiresAt: clock.Now().Add(5 * time.Minute)}
	cfg := config.IdentityConfig{
		ClientID:            "axi-web",
		SessionCookieName:   "axi_session",
		SessionTTL:          8 * time.Hour,
		SessionIdleTTL:      time.Hour,
		SessionAbsoluteTTL:  3 * time.Hour,
		AllowedReturnURLs:   []string{"https://web.axi.test/auth/callback"},
		SessionRenewAfter:   0,
		SessionCookieSecure: true,
	}
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, client, clock.Now)

	location, err := service.Begin(context.Background(), "https://web.axi.test/auth/callback")
	if err != nil {
		t.Fatalf("begin OIDC: %v", err)
	}
	authorizationURL, err := url.Parse(location)
	if err != nil {
		t.Fatalf("parse authorization URL: %v", err)
	}
	sessionID, session, _, err := service.Complete(context.Background(), authorizationURL.Query().Get("state"), "valid-code")
	if err != nil {
		t.Fatalf("complete OIDC: %v", err)
	}
	if want := clock.Now().Add(3 * time.Hour); !session.ExpiresAt.Equal(want) {
		t.Fatalf("OIDC browser absolute expiry = %s, want %s", session.ExpiresAt, want)
	}
	if want := clock.Now().Add(time.Hour); !session.IdleExpiresAt.Equal(want) {
		t.Fatalf("OIDC browser idle expiry = %s, want %s", session.IdleExpiresAt, want)
	}
	if !session.LastSeenAt.Equal(clock.Now()) || !session.RenewedAt.Equal(clock.Now()) {
		t.Fatalf("OIDC policy timestamps = last seen %s, renewed %s, want %s", session.LastSeenAt, session.RenewedAt, clock.Now())
	}

	clock.Advance(30 * time.Minute)
	principal, restoredID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID))
	if err != nil || principal.Subject != "zitadel-subject" || restoredID != sessionID {
		t.Fatalf("restore after OIDC token expiry = principal %#v id %q err %v", principal, restoredID, err)
	}
}

func TestRestoreSessionSurvivesGatewayRestartWithSharedStore(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 11, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	store := NewMemoryRecordStore(clock.Now)
	issuer := NewForTest(cfg, store, nil, clock.Now)
	sessionID, err := issuer.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	restartedGateway := NewForTest(cfg, store, nil, clock.Now)
	principal, restoredID, err := restoreSession(t, restartedGateway, sessionRequest(cfg.SessionCookieName, sessionID))
	if err != nil {
		t.Fatalf("restore through restarted gateway: %v", err)
	}
	if principal.Subject != "owner-subject" || principal.Email != "owner@axi.test" || restoredID != sessionID {
		t.Fatalf("restored principal/id = %#v / %q", principal, restoredID)
	}
}

func TestRestoreSessionRefreshesIdleWithoutExtendingAbsoluteExpiry(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionIdleTTL = 45 * time.Minute
	cfg.SessionAbsoluteTTL = time.Hour
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	clock.Advance(30 * time.Minute)
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID)); err != nil {
		t.Fatalf("restore active session: %v", err)
	}
	refreshed := storedSession(t, store, sessionID)
	if want := time.Date(2026, 8, 11, 13, 0, 0, 0, time.UTC); !refreshed.ExpiresAt.Equal(want) {
		t.Fatalf("absolute expiry = %s, want %s", refreshed.ExpiresAt, want)
	}
	if !refreshed.IdleExpiresAt.Equal(refreshed.ExpiresAt) {
		t.Fatalf("refreshed idle expiry = %s, want clamp at absolute %s", refreshed.IdleExpiresAt, refreshed.ExpiresAt)
	}
	if !refreshed.LastSeenAt.Equal(clock.Now()) {
		t.Fatalf("last seen = %s, want %s", refreshed.LastSeenAt, clock.Now())
	}

	clock.Advance(30 * time.Minute)
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("absolute expiry restore error = %v, want ErrUnauthorized", err)
	}
}

func TestRestoreSessionRotatesOpaqueIDAndInvalidatesOldID(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 13, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionRenewAfter = 15 * time.Minute
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	oldSessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	clock.Advance(15 * time.Minute)
	principal, newSessionID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, oldSessionID))
	if err != nil {
		t.Fatalf("restore and rotate session: %v", err)
	}
	if principal.Subject != "owner-subject" || newSessionID == "" || newSessionID == oldSessionID {
		t.Fatalf("rotated principal/id = %#v / %q, old %q", principal, newSessionID, oldSessionID)
	}
	if _, err := store.Get(context.Background(), sessionKey(oldSessionID)); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("old rotated key error = %v, want ErrRecordNotFound", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, oldSessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old rotated cookie restore error = %v, want ErrUnauthorized", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, newSessionID)); err != nil {
		t.Fatalf("new rotated cookie restore error = %v", err)
	}
}

func TestRestoreSessionRejectsIdleExpiryAndLogout(t *testing.T) {
	t.Run("idle expiry", func(t *testing.T) {
		clock := &testClock{now: time.Date(2026, 8, 11, 14, 0, 0, 0, time.UTC)}
		cfg := emailSessionConfig()
		cfg.SessionIdleTTL = 20 * time.Minute
		store := NewMemoryRecordStore(clock.Now)
		service := NewForTest(cfg, store, nil, clock.Now)
		sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
		if err != nil {
			t.Fatalf("issue email session: %v", err)
		}
		clock.Advance(20 * time.Minute)
		if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID)); !errors.Is(err, ErrUnauthorized) {
			t.Fatalf("idle expiry restore error = %v, want ErrUnauthorized", err)
		}
	})

	t.Run("logout", func(t *testing.T) {
		clock := &testClock{now: time.Date(2026, 8, 11, 15, 0, 0, 0, time.UTC)}
		cfg := emailSessionConfig()
		store := NewMemoryRecordStore(clock.Now)
		service := NewForTest(cfg, store, nil, clock.Now)
		sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
		if err != nil {
			t.Fatalf("issue email session: %v", err)
		}
		request := sessionRequest(cfg.SessionCookieName, sessionID)
		if err := service.Logout(context.Background(), request); err != nil {
			t.Fatalf("logout: %v", err)
		}
		if _, _, err := restoreSession(t, service, request); !errors.Is(err, ErrUnauthorized) {
			t.Fatalf("logged-out restore error = %v, want ErrUnauthorized", err)
		}
	})
}

func TestRestoreSessionLegacyRecordNeverExtendsItsExistingExpiry(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 16, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionIdleTTL = 2 * time.Hour
	cfg.SessionAbsoluteTTL = 8 * time.Hour
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	legacySessionID := "legacy-opaque-id"
	legacyExpiresAt := clock.Now().Add(time.Hour)
	encoded, err := json.Marshal(browserSession{
		Principal: Principal{Subject: "legacy-subject", Email: "legacy@axi.test"},
		ExpiresAt: legacyExpiresAt,
	})
	if err != nil {
		t.Fatalf("encode legacy session: %v", err)
	}
	if err := store.Set(context.Background(), sessionKey(legacySessionID), encoded, time.Hour); err != nil {
		t.Fatalf("persist legacy session: %v", err)
	}

	clock.Advance(15 * time.Minute)
	principal, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, legacySessionID))
	if err != nil || principal.Subject != "legacy-subject" {
		t.Fatalf("restore legacy session = %#v, %v", principal, err)
	}
	refreshed := storedSession(t, store, legacySessionID)
	if !refreshed.ExpiresAt.Equal(legacyExpiresAt) || !refreshed.IdleExpiresAt.Equal(legacyExpiresAt) {
		t.Fatalf("legacy expiries after restore = absolute %s idle %s, want %s", refreshed.ExpiresAt, refreshed.IdleExpiresAt, legacyExpiresAt)
	}

	clock.Advance(45 * time.Minute)
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, legacySessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("legacy expiry restore error = %v, want ErrUnauthorized", err)
	}
}

func TestLegacySessionTTLFallsBackForEmailPolicy(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 17, 0, 0, 0, time.UTC)}
	cfg := config.IdentityConfig{
		SessionCookieName:    "axi_session",
		SessionTTL:           90 * time.Minute,
		EmailLoginOwnerEmail: "owner@axi.test",
		EmailLoginSubject:    "owner-subject",
	}
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue legacy-compatible email session: %v", err)
	}
	session := storedSession(t, store, sessionID)
	if want := clock.Now().Add(90 * time.Minute); !session.ExpiresAt.Equal(want) || !session.IdleExpiresAt.Equal(want) {
		t.Fatalf("legacy policy expiries = absolute %s idle %s, want %s", session.ExpiresAt, session.IdleExpiresAt, want)
	}
	if !session.LastSeenAt.Equal(clock.Now()) || !session.RenewedAt.Equal(clock.Now()) {
		t.Fatalf("legacy policy timestamps = last seen %s renewed %s, want %s", session.LastSeenAt, session.RenewedAt, clock.Now())
	}
}

func TestNewRejectsMissingRedisWhenDurableSessionsAreRequired(t *testing.T) {
	service, err := New(context.Background(), config.IdentityConfig{RequireDurableSessionStore: true})
	if err == nil {
		if service != nil {
			_ = service.Close()
		}
		t.Fatal("New accepted an empty Redis URL while durable sessions are required")
	}
}

func TestSetCookieUsesEffectiveIdleTTLAndPreservesSecurityFlags(t *testing.T) {
	cfg := config.IdentityConfig{
		SessionCookieName:   "axi_session",
		SessionCookieDomain: "web.axi.test",
		SessionCookieSecure: true,
		SessionTTL:          8 * time.Hour,
		SessionIdleTTL:      30 * time.Minute,
		SessionAbsoluteTTL:  2 * time.Hour,
	}
	service := NewForTest(cfg, NewMemoryRecordStore(nil), nil, nil)
	response := httptest.NewRecorder()
	service.SetCookie(response, "opaque-session-id")

	cookies := response.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("SetCookie produced %d cookies, want 1", len(cookies))
	}
	if cookies[0].MaxAge != int((30 * time.Minute).Seconds()) {
		t.Fatalf("cookie MaxAge = %d, want %d", cookies[0].MaxAge, int((30 * time.Minute).Seconds()))
	}
	header := response.Header().Get("Set-Cookie")
	for _, required := range []string{"HttpOnly", "Secure", "SameSite=Lax", "Domain=web.axi.test"} {
		if !strings.Contains(header, required) {
			t.Fatalf("Set-Cookie header %q missing %q", header, required)
		}
	}
}
