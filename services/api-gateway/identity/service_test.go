package identity

import (
	"bytes"
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

func rotateRecord(t *testing.T, store RecordStore, oldKey string, expected []byte, newKey string, value []byte, ttl time.Duration, tombstone []byte, tombstoneTTL time.Duration) error {
	t.Helper()
	return store.Rotate(context.Background(), oldKey, expected, newKey, value, ttl, tombstone, tombstoneTTL)
}

func compareAndSetRecord(t *testing.T, store RecordStore, key string, expected, next []byte, ttl time.Duration) error {
	t.Helper()
	return store.CompareAndSet(context.Background(), key, expected, next, ttl)
}

func compareAndDeleteRecord(t *testing.T, store RecordStore, key string, expected []byte) error {
	t.Helper()
	return store.CompareAndDelete(context.Background(), key, expected)
}

func supersessionTombstone(t *testing.T, successor string) []byte {
	t.Helper()
	record, err := json.Marshal(map[string]string{"supersededBy": successor})
	if err != nil {
		t.Fatalf("encode supersession tombstone: %v", err)
	}
	return record
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
	expectedOldValue, err := store.Get(context.Background(), "old")
	if err != nil {
		t.Fatalf("get old record before rotate: %v", err)
	}

	newValue := []byte("new-value")
	if err := rotateRecord(t, store, "old", expectedOldValue, "new", newValue, 30*time.Minute, supersessionTombstone(t, "new"), time.Hour); err != nil {
		t.Fatalf("rotate record: %v", err)
	}
	newValue[0] = 'x'
	oldRecord, err := store.Get(context.Background(), "old")
	if err != nil {
		t.Fatalf("get tombstoned old record: %v", err)
	}
	var oldTombstone struct {
		SupersededBy string `json:"supersededBy"`
	}
	if err := json.Unmarshal(oldRecord, &oldTombstone); err != nil || oldTombstone.SupersededBy != "new" {
		t.Fatalf("old record tombstone = %#v, %v", oldTombstone, err)
	}
	got, err := store.Get(context.Background(), "new")
	if err != nil {
		t.Fatalf("get rotated record: %v", err)
	}
	if string(got) != "new-value" {
		t.Fatalf("rotated value = %q, want copied new value", got)
	}

	if err := rotateRecord(t, store, "missing", []byte("missing"), "absent-new", []byte("should-not-write"), time.Hour, supersessionTombstone(t, "absent-new"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("missing old record error = %v, want ErrRecordNotFound", err)
	}
	if _, err := store.Get(context.Background(), "absent-new"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("new record after missing-old rotate error = %v, want ErrRecordNotFound", err)
	}

	if err := store.Set(context.Background(), "expired", []byte("expired-value"), time.Minute); err != nil {
		t.Fatalf("set expiring record: %v", err)
	}
	expectedExpiredValue, err := store.Get(context.Background(), "expired")
	if err != nil {
		t.Fatalf("get expiring record before rotate: %v", err)
	}
	clock.Advance(time.Minute)
	if err := rotateRecord(t, store, "expired", expectedExpiredValue, "expired-new", []byte("should-not-write"), time.Hour, supersessionTombstone(t, "expired-new"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("expired old record error = %v, want ErrRecordNotFound", err)
	}
	if _, err := store.Get(context.Background(), "expired-new"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("new record after expired-old rotate error = %v, want ErrRecordNotFound", err)
	}
}

func TestMemoryRecordStoreConditionalWritesCannotReviveStaleRecords(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 9, 30, 0, 0, time.UTC)}
	store := NewMemoryRecordStore(clock.Now)
	if err := store.Set(context.Background(), "deleted", []byte("before-delete"), time.Hour); err != nil {
		t.Fatalf("set deleted record: %v", err)
	}
	expectedDeleted, err := store.Get(context.Background(), "deleted")
	if err != nil {
		t.Fatalf("get deleted record: %v", err)
	}
	if err := store.Delete(context.Background(), "deleted"); err != nil {
		t.Fatalf("delete record: %v", err)
	}
	if err := compareAndSetRecord(t, store, "deleted", expectedDeleted, []byte("stale-revival"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("stale compare-and-set error = %v, want ErrRecordNotFound", err)
	}
	if _, err := store.Get(context.Background(), "deleted"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("deleted record after stale compare-and-set error = %v, want ErrRecordNotFound", err)
	}

	if err := store.Set(context.Background(), "rotated", []byte("before-rotate"), time.Hour); err != nil {
		t.Fatalf("set rotating record: %v", err)
	}
	expectedRotated, err := store.Get(context.Background(), "rotated")
	if err != nil {
		t.Fatalf("get rotating record: %v", err)
	}
	if err := rotateRecord(t, store, "rotated", expectedRotated, "live-replacement", []byte("live-value"), time.Hour, supersessionTombstone(t, "live-replacement"), time.Hour); err != nil {
		t.Fatalf("live rotate: %v", err)
	}
	if err := rotateRecord(t, store, "rotated", expectedRotated, "stale-replacement", []byte("stale-value"), time.Hour, supersessionTombstone(t, "stale-replacement"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("stale rotate error = %v, want ErrRecordNotFound", err)
	}
	if err := compareAndSetRecord(t, store, "rotated", expectedRotated, []byte("stale-compare-and-set"), time.Hour); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("stale compare-and-set after rotate error = %v, want ErrRecordNotFound", err)
	}
	rotatedRecord, err := store.Get(context.Background(), "rotated")
	if err != nil {
		t.Fatalf("get tombstoned old key after stale updates: %v", err)
	}
	if !bytes.Equal(rotatedRecord, supersessionTombstone(t, "live-replacement")) {
		t.Fatalf("tombstoned old key was rewritten: %q", rotatedRecord)
	}
	if _, err := store.Get(context.Background(), "stale-replacement"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("stale replacement error = %v, want ErrRecordNotFound", err)
	}
	if liveValue, err := store.Get(context.Background(), "live-replacement"); err != nil || string(liveValue) != "live-value" {
		t.Fatalf("live replacement = %q, %v", liveValue, err)
	}
}

func TestMemoryRecordStoreCompareAndDeleteRejectsStaleExpectedValue(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 9, 45, 0, 0, time.UTC)}
	store := NewMemoryRecordStore(clock.Now)
	if err := store.Set(context.Background(), "active", []byte("before"), time.Hour); err != nil {
		t.Fatalf("set active record: %v", err)
	}
	expected, err := store.Get(context.Background(), "active")
	if err != nil {
		t.Fatalf("get active record: %v", err)
	}
	if err := store.Set(context.Background(), "active", []byte("after"), time.Hour); err != nil {
		t.Fatalf("replace active record: %v", err)
	}
	if err := compareAndDeleteRecord(t, store, "active", expected); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("stale compare-and-delete error = %v, want ErrRecordNotFound", err)
	}
	current, err := store.Get(context.Background(), "active")
	if err != nil || string(current) != "after" {
		t.Fatalf("active record after stale compare-and-delete = %q, %v", current, err)
	}
	if err := compareAndDeleteRecord(t, store, "active", current); err != nil {
		t.Fatalf("delete matching active record: %v", err)
	}
	if _, err := store.Get(context.Background(), "active"); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("deleted active record error = %v, want ErrRecordNotFound", err)
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
	if _, err := store.Get(context.Background(), sessionKey(oldSessionID)); err != nil {
		t.Fatalf("get tombstoned old key: %v", err)
	}
	oldRequest := sessionRequest(cfg.SessionCookieName, oldSessionID)
	if _, err := service.Authenticate(context.Background(), oldRequest); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old rotated cookie authentication error = %v, want ErrUnauthorized", err)
	}
	if _, _, err := restoreSession(t, service, oldRequest); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old rotated cookie restore error = %v, want ErrUnauthorized", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, newSessionID)); err != nil {
		t.Fatalf("new rotated cookie restore error = %v", err)
	}
}

func TestLogoutWithRotatedPredecessorCookieRevokesSuccessor(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 13, 30, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionRenewAfter = 5 * time.Minute
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	oldSessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	clock.Advance(5 * time.Minute)
	_, newSessionID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, oldSessionID))
	if err != nil || newSessionID == oldSessionID {
		t.Fatalf("rotate session = %q, %v", newSessionID, err)
	}
	if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, oldSessionID)); err != nil {
		t.Fatalf("logout predecessor cookie: %v", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, newSessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("successor after predecessor logout error = %v, want ErrUnauthorized", err)
	}
}

func TestLogoutWithOriginalCookieRevokesRepeatedRotationChain(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 13, 45, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionRenewAfter = 5 * time.Minute
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	originalSessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	clock.Advance(5 * time.Minute)
	_, firstSuccessorID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, originalSessionID))
	if err != nil || firstSuccessorID == originalSessionID {
		t.Fatalf("first rotate = %q, %v", firstSuccessorID, err)
	}
	clock.Advance(5 * time.Minute)
	_, finalSuccessorID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, firstSuccessorID))
	if err != nil || finalSuccessorID == firstSuccessorID {
		t.Fatalf("second rotate = %q, %v", finalSuccessorID, err)
	}
	if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, originalSessionID)); err != nil {
		t.Fatalf("logout original predecessor: %v", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, finalSuccessorID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("final successor after original logout error = %v, want ErrUnauthorized", err)
	}
}

func TestLogoutWithOriginalCookieRevokesMoreThanSixteenRotations(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 14, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionRenewAfter = 5 * time.Minute
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	originalSessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}

	currentSessionID := originalSessionID
	for rotation := 0; rotation < 20; rotation++ {
		clock.Advance(5 * time.Minute)
		_, nextSessionID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, currentSessionID))
		if err != nil || nextSessionID == currentSessionID {
			t.Fatalf("rotation %d = %q, %v", rotation+1, nextSessionID, err)
		}
		currentSessionID = nextSessionID
	}

	if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, originalSessionID)); err != nil {
		t.Fatalf("logout original predecessor after long chain: %v", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, currentSessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("final successor after long-chain predecessor logout error = %v, want ErrUnauthorized", err)
	}
}

func TestLogoutRejectsCyclicOrMalformedTombstoneChains(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 14, 30, 0, 0, time.UTC)}
	cfg := emailSessionConfig()

	t.Run("self reference", func(t *testing.T) {
		store := NewMemoryRecordStore(clock.Now)
		service := NewForTest(cfg, store, nil, clock.Now)
		if err := store.Set(context.Background(), sessionKey("loop"), supersessionTombstone(t, "loop"), time.Hour); err != nil {
			t.Fatalf("store self-referential tombstone: %v", err)
		}
		if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, "loop")); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("self-referential tombstone logout error = %v, want ErrSessionStoreUnavailable", err)
		}
	})

	t.Run("empty successor", func(t *testing.T) {
		store := NewMemoryRecordStore(clock.Now)
		service := NewForTest(cfg, store, nil, clock.Now)
		if err := store.Set(context.Background(), sessionKey("malformed"), []byte(`{"supersededBy":""}`), time.Hour); err != nil {
			t.Fatalf("store malformed tombstone: %v", err)
		}
		if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, "malformed")); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("malformed tombstone logout error = %v, want ErrSessionStoreUnavailable", err)
		}
	})

	t.Run("invalid tombstone JSON", func(t *testing.T) {
		store := NewMemoryRecordStore(clock.Now)
		service := NewForTest(cfg, store, nil, clock.Now)
		if err := store.Set(context.Background(), sessionKey("invalid"), []byte(`{"supersededBy":}`), time.Hour); err != nil {
			t.Fatalf("store invalid tombstone JSON: %v", err)
		}
		if err := service.Logout(context.Background(), sessionRequest(cfg.SessionCookieName, "invalid")); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("invalid tombstone JSON logout error = %v, want ErrSessionStoreUnavailable", err)
		}
	})
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

func TestRestoreSessionLegacyRecordNeverMutatesOrRenewsIt(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 16, 0, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	cfg.SessionIdleTTL = 15 * time.Minute
	cfg.SessionAbsoluteTTL = 8 * time.Hour
	cfg.SessionRenewAfter = 5 * time.Minute
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	legacySessionID := "legacy-opaque-id"
	legacyExpiresAt := clock.Now().Add(time.Hour)
	encoded, err := json.Marshal(struct {
		Principal Principal `json:"principal"`
		ExpiresAt time.Time `json:"expiresAt"`
	}{
		Principal: Principal{Subject: "legacy-subject", Email: "legacy@axi.test"},
		ExpiresAt: legacyExpiresAt,
	})
	if err != nil {
		t.Fatalf("encode legacy session: %v", err)
	}
	if err := store.Set(context.Background(), sessionKey(legacySessionID), encoded, time.Hour); err != nil {
		t.Fatalf("persist legacy session: %v", err)
	}

	clock.Advance(5 * time.Minute)
	principal, returnedID, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, legacySessionID))
	if err != nil || principal.Subject != "legacy-subject" || returnedID != legacySessionID {
		t.Fatalf("first legacy restore = principal %#v id %q err %v", principal, returnedID, err)
	}
	storedRaw, err := store.Get(context.Background(), sessionKey(legacySessionID))
	if err != nil {
		t.Fatalf("get legacy record after restore: %v", err)
	}
	if !bytes.Equal(storedRaw, encoded) {
		t.Fatalf("legacy record was rewritten: got %s, want %s", storedRaw, encoded)
	}
	untouched := storedSession(t, store, legacySessionID)
	if !untouched.IdleExpiresAt.IsZero() || !untouched.LastSeenAt.IsZero() || !untouched.RenewedAt.IsZero() {
		t.Fatalf("legacy lifecycle fields were added: %#v", untouched)
	}

	clock.Advance(5 * time.Minute)
	principal, returnedID, err = restoreSession(t, service, sessionRequest(cfg.SessionCookieName, legacySessionID))
	if err != nil || principal.Subject != "legacy-subject" || returnedID != legacySessionID {
		t.Fatalf("renewal-threshold legacy restore = principal %#v id %q err %v", principal, returnedID, err)
	}
	storedRaw, err = store.Get(context.Background(), sessionKey(legacySessionID))
	if err != nil || !bytes.Equal(storedRaw, encoded) {
		t.Fatalf("legacy record changed at renewal threshold: raw %s err %v", storedRaw, err)
	}

	clock.Advance(50 * time.Minute)
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, legacySessionID)); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("legacy expiry restore error = %v, want ErrUnauthorized", err)
	}
}

type deleteAfterGetMemoryStore struct {
	*MemoryRecordStore
	afterGet func()
}

func (s *deleteAfterGetMemoryStore) Get(ctx context.Context, key string) ([]byte, error) {
	value, err := s.MemoryRecordStore.Get(ctx, key)
	if err == nil && s.afterGet != nil {
		afterGet := s.afterGet
		s.afterGet = nil
		afterGet()
	}
	return value, err
}

func TestRestoreSessionCannotReviveSessionDeletedAfterRead(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 16, 30, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	backingStore := NewMemoryRecordStore(clock.Now)
	store := &deleteAfterGetMemoryStore{MemoryRecordStore: backingStore}
	service := NewForTest(cfg, store, nil, clock.Now)
	sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue email session: %v", err)
	}
	request := sessionRequest(cfg.SessionCookieName, sessionID)
	var logoutErr error
	store.afterGet = func() {
		logoutErr = service.Logout(context.Background(), request)
	}
	if _, _, err := restoreSession(t, service, request); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("stale restore after logout error = %v, want ErrUnauthorized", err)
	}
	if logoutErr != nil {
		t.Fatalf("logout during stale restore: %v", logoutErr)
	}
	if _, err := backingStore.Get(context.Background(), sessionKey(sessionID)); !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("old session was revived after stale restore: %v", err)
	}
}

func TestRestoreSessionRejectsBadJSON(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 17, 30, 0, 0, time.UTC)}
	cfg := emailSessionConfig()
	store := NewMemoryRecordStore(clock.Now)
	service := NewForTest(cfg, store, nil, clock.Now)
	if err := store.Set(context.Background(), sessionKey("bad-json"), []byte("{not-json"), time.Hour); err != nil {
		t.Fatalf("store malformed session: %v", err)
	}
	if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, "bad-json")); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("bad JSON restore error = %v, want ErrUnauthorized", err)
	}
}

type failingRecordStore struct {
	*MemoryRecordStore
	getErr           error
	compareAndSetErr error
	rotateErr        error
}

func (s *failingRecordStore) Get(ctx context.Context, key string) ([]byte, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	return s.MemoryRecordStore.Get(ctx, key)
}

func (s *failingRecordStore) CompareAndSet(ctx context.Context, key string, expected, next []byte, ttl time.Duration) error {
	if s.compareAndSetErr != nil {
		return s.compareAndSetErr
	}
	return s.MemoryRecordStore.CompareAndSet(ctx, key, expected, next, ttl)
}

func (s *failingRecordStore) Rotate(ctx context.Context, oldKey string, expected []byte, newKey string, next []byte, ttl time.Duration, tombstone []byte, tombstoneTTL time.Duration) error {
	if s.rotateErr != nil {
		return s.rotateErr
	}
	return s.MemoryRecordStore.Rotate(ctx, oldKey, expected, newKey, next, ttl, tombstone, tombstoneTTL)
}

func TestRestoreSessionMapsStoreIOFailures(t *testing.T) {
	t.Run("get", func(t *testing.T) {
		clock := &testClock{now: time.Date(2026, 8, 11, 18, 0, 0, 0, time.UTC)}
		cfg := emailSessionConfig()
		store := &failingRecordStore{MemoryRecordStore: NewMemoryRecordStore(clock.Now), getErr: errors.New("get failed")}
		service := NewForTest(cfg, store, nil, clock.Now)
		if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, "unavailable")); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("get failure restore error = %v, want ErrSessionStoreUnavailable", err)
		}
	})

	t.Run("compare and set", func(t *testing.T) {
		clock := &testClock{now: time.Date(2026, 8, 11, 18, 15, 0, 0, time.UTC)}
		cfg := emailSessionConfig()
		store := &failingRecordStore{MemoryRecordStore: NewMemoryRecordStore(clock.Now), compareAndSetErr: errors.New("compare-and-set failed")}
		service := NewForTest(cfg, store, nil, clock.Now)
		sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
		if err != nil {
			t.Fatalf("issue email session: %v", err)
		}
		if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID)); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("compare-and-set failure restore error = %v, want ErrSessionStoreUnavailable", err)
		}
	})

	t.Run("rotate", func(t *testing.T) {
		clock := &testClock{now: time.Date(2026, 8, 11, 18, 30, 0, 0, time.UTC)}
		cfg := emailSessionConfig()
		cfg.SessionRenewAfter = 5 * time.Minute
		store := &failingRecordStore{MemoryRecordStore: NewMemoryRecordStore(clock.Now), rotateErr: errors.New("rotate failed")}
		service := NewForTest(cfg, store, nil, clock.Now)
		sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
		if err != nil {
			t.Fatalf("issue email session: %v", err)
		}
		clock.Advance(5 * time.Minute)
		if _, _, err := restoreSession(t, service, sessionRequest(cfg.SessionCookieName, sessionID)); !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("rotate failure restore error = %v, want ErrSessionStoreUnavailable", err)
		}
	})
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

type trackedRecordStore struct {
	*MemoryRecordStore
	pingErr    error
	pingCalls  int
	closeCalls int
}

func (s *trackedRecordStore) Ping(context.Context) error {
	s.pingCalls++
	return s.pingErr
}

func (s *trackedRecordStore) Close() error {
	s.closeCalls++
	return nil
}

func replaceRedisStoreFactory(t *testing.T, factory func(string) (RecordStore, error)) {
	t.Helper()
	previous := newRedisRecordStore
	newRedisRecordStore = factory
	t.Cleanup(func() {
		newRedisRecordStore = previous
	})
}

func TestNewPingsEveryConfiguredRedisStore(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		store := &trackedRecordStore{MemoryRecordStore: NewMemoryRecordStore(nil)}
		factoryCalls := 0
		replaceRedisStoreFactory(t, func(redisURL string) (RecordStore, error) {
			factoryCalls++
			if redisURL != "redis://session-store.test:6379/0" {
				t.Fatalf("factory Redis URL = %q", redisURL)
			}
			return store, nil
		})
		service, err := New(context.Background(), config.IdentityConfig{RedisURL: "redis://session-store.test:6379/0"})
		if err != nil {
			t.Fatalf("New configured Redis store: %v", err)
		}
		if factoryCalls != 1 || store.pingCalls != 1 || store.closeCalls != 0 {
			t.Fatalf("factory/ping/close calls = %d/%d/%d, want 1/1/0", factoryCalls, store.pingCalls, store.closeCalls)
		}
		if err := service.Close(); err != nil {
			t.Fatalf("close returned service: %v", err)
		}
		if store.closeCalls != 1 {
			t.Fatalf("close calls after Service.Close = %d, want 1", store.closeCalls)
		}
	})

	t.Run("ping failure closes store", func(t *testing.T) {
		store := &trackedRecordStore{MemoryRecordStore: NewMemoryRecordStore(nil), pingErr: errors.New("ping failed")}
		replaceRedisStoreFactory(t, func(string) (RecordStore, error) {
			return store, nil
		})
		service, err := New(context.Background(), config.IdentityConfig{RedisURL: "redis://session-store.test:6379/0"})
		if service != nil || !errors.Is(err, ErrSessionStoreUnavailable) {
			t.Fatalf("New failed configured Redis store = service %v err %v", service, err)
		}
		if store.pingCalls != 1 || store.closeCalls != 1 {
			t.Fatalf("ping/close calls = %d/%d, want 1/1", store.pingCalls, store.closeCalls)
		}
	})
}

func TestMemoryRecordStoreRejectsInvalidWriteTTLsWithoutMutation(t *testing.T) {
	clock := &testClock{now: time.Date(2026, 8, 11, 19, 0, 0, 0, time.UTC)}
	invalidTTLs := []time.Duration{0, -time.Millisecond, 500 * time.Microsecond}
	for _, ttl := range invalidTTLs {
		t.Run(ttl.String(), func(t *testing.T) {
			store := NewMemoryRecordStore(clock.Now)
			if err := store.Set(context.Background(), "set", []byte("before-set"), time.Hour); err != nil {
				t.Fatalf("set baseline: %v", err)
			}
			if err := store.Set(context.Background(), "set", []byte("after-set"), ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Set invalid TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if got, err := store.Get(context.Background(), "set"); err != nil || !bytes.Equal(got, []byte("before-set")) {
				t.Fatalf("Set invalid TTL mutated record = %q, %v", got, err)
			}

			if err := store.Set(context.Background(), "cas", []byte("before-cas"), time.Hour); err != nil {
				t.Fatalf("set CAS baseline: %v", err)
			}
			expected, err := store.Get(context.Background(), "cas")
			if err != nil {
				t.Fatalf("get CAS baseline: %v", err)
			}
			if err := store.CompareAndSet(context.Background(), "cas", expected, []byte("after-cas"), ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("CompareAndSet invalid TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if got, err := store.Get(context.Background(), "cas"); err != nil || !bytes.Equal(got, expected) {
				t.Fatalf("CompareAndSet invalid TTL mutated record = %q, %v", got, err)
			}

			if err := store.Set(context.Background(), "old", []byte("before-old"), time.Hour); err != nil {
				t.Fatalf("set Rotate old baseline: %v", err)
			}
			old, err := store.Get(context.Background(), "old")
			if err != nil {
				t.Fatalf("get Rotate old baseline: %v", err)
			}
			if err := store.Set(context.Background(), "new", []byte("before-new"), time.Hour); err != nil {
				t.Fatalf("set Rotate new baseline: %v", err)
			}
			beforeNew, err := store.Get(context.Background(), "new")
			if err != nil {
				t.Fatalf("get Rotate new baseline: %v", err)
			}
			tombstone := supersessionTombstone(t, "new")
			if err := store.Rotate(context.Background(), "old", old, "new", []byte("after-new"), ttl, tombstone, time.Hour); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Rotate invalid successor TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if got, err := store.Get(context.Background(), "old"); err != nil || !bytes.Equal(got, old) {
				t.Fatalf("Rotate invalid successor TTL mutated old record = %q, %v", got, err)
			}
			if got, err := store.Get(context.Background(), "new"); err != nil || !bytes.Equal(got, beforeNew) {
				t.Fatalf("Rotate invalid successor TTL mutated new record = %q, %v", got, err)
			}

			if err := store.Rotate(context.Background(), "old", old, "new", []byte("after-new"), time.Hour, tombstone, ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Rotate invalid tombstone TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if got, err := store.Get(context.Background(), "old"); err != nil || !bytes.Equal(got, old) {
				t.Fatalf("Rotate invalid tombstone TTL mutated old record = %q, %v", got, err)
			}
			if got, err := store.Get(context.Background(), "new"); err != nil || !bytes.Equal(got, beforeNew) {
				t.Fatalf("Rotate invalid tombstone TTL mutated new record = %q, %v", got, err)
			}
		})
	}
}

func TestRedisRecordStoreRejectsInvalidWriteTTLsBeforeNetwork(t *testing.T) {
	store, err := NewRedisRecordStore("redis://127.0.0.1:1/0")
	if err != nil {
		t.Fatalf("create Redis record store: %v", err)
	}
	defer store.Close()
	for _, ttl := range []time.Duration{0, -time.Millisecond, 500 * time.Microsecond} {
		t.Run(ttl.String(), func(t *testing.T) {
			if err := store.Set(context.Background(), "set", []byte("value"), ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Set invalid TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if err := store.CompareAndSet(context.Background(), "cas", []byte("old"), []byte("new"), ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("CompareAndSet invalid TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if err := store.Rotate(context.Background(), "old", []byte("old"), "new", []byte("new"), ttl, supersessionTombstone(t, "new"), time.Hour); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Rotate invalid successor TTL error = %v, want ErrRecordTTLTooShort", err)
			}
			if err := store.Rotate(context.Background(), "old", []byte("old"), "new", []byte("new"), time.Hour, supersessionTombstone(t, "new"), ttl); !errors.Is(err, ErrRecordTTLTooShort) {
				t.Fatalf("Rotate invalid tombstone TTL error = %v, want ErrRecordTTLTooShort", err)
			}
		})
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
