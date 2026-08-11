package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/identity"
	"github.com/gin-gonic/gin"
)

type middlewareClock struct {
	now time.Time
}

func (c *middlewareClock) Now() time.Time {
	return c.now
}

func (c *middlewareClock) Advance(duration time.Duration) {
	c.now = c.now.Add(duration)
}

func middlewareIdentityConfig() config.IdentityConfig {
	return config.IdentityConfig{
		SessionCookieName:     "axi_session",
		SessionTTL:            8 * time.Hour,
		SessionIdleTTL:        time.Hour,
		SessionAbsoluteTTL:    4 * time.Hour,
		EmailLoginOwnerEmail:  "owner@axi.test",
		EmailLoginSubject:     "owner-subject",
		DevelopmentHeaderAuth: true,
	}
}

func newMiddlewareIdentityService(cfg config.IdentityConfig, store identity.RecordStore, now func() time.Time) *identity.Service {
	return identity.NewForTest(cfg, store, nil, now)
}

func issueMiddlewareSession(t *testing.T, service *identity.Service) string {
	t.Helper()
	sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue browser session: %v", err)
	}
	return sessionID
}

func protectedHandler(c *gin.Context) {
	principal, ok := PrincipalFromContext(c)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "principal context missing"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"subject": principal.Subject})
}

func middlewareRequestWithCookie(cookieName, sessionID string) *http.Request {
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.AddCookie(&http.Cookie{Name: cookieName, Value: sessionID})
	return request
}

func middlewareResponseCookie(t *testing.T, recorder *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("response did not set %q cookie: %v", name, recorder.Header().Values("Set-Cookie"))
	return nil
}

type unavailableMiddlewareStore struct {
	*identity.MemoryRecordStore
	getErr error
}

func (s *unavailableMiddlewareStore) Get(ctx context.Context, key string) ([]byte, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	return s.MemoryRecordStore.Get(ctx, key)
}

type middlewareBearerOIDCClient struct{}

func (middlewareBearerOIDCClient) AuthorizationURL(string, string, string) string {
	return ""
}

func (middlewareBearerOIDCClient) Exchange(context.Context, string, identity.AuthorizationTransactionForTest) (identity.BrowserSessionForTest, error) {
	return identity.BrowserSessionForTest{}, identity.ErrUnauthorized
}

func (middlewareBearerOIDCClient) VerifyBearer(_ context.Context, token string) (identity.Principal, error) {
	if token != "valid-bearer" {
		return identity.Principal{}, identity.ErrUnauthorized
	}
	return identity.Principal{Subject: "bearer-user"}, nil
}

func TestRequireIdentityRestoresBrowserSessionAndRefreshesCookie(t *testing.T) {
	clock := &middlewareClock{now: time.Date(2026, 8, 11, 12, 0, 0, 0, time.UTC)}
	cfg := middlewareIdentityConfig()
	service := newMiddlewareIdentityService(cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)
	sessionID := issueMiddlewareSession(t, service)

	router := gin.New()
	router.Use(RequireIdentity(service))
	router.GET("/protected", protectedHandler)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, middlewareRequestWithCookie(cfg.SessionCookieName, sessionID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("protected status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode protected response: %v", err)
	}
	if response["subject"] != "owner-subject" {
		t.Fatalf("protected response = %#v", response)
	}
	if cookie := middlewareResponseCookie(t, recorder, cfg.SessionCookieName); cookie.Value != sessionID {
		t.Fatalf("refreshed session cookie = %q, want %q", cookie.Value, sessionID)
	}
}

func TestRequireIdentityRotatesBrowserSessionCookie(t *testing.T) {
	clock := &middlewareClock{now: time.Date(2026, 8, 11, 12, 15, 0, 0, time.UTC)}
	cfg := middlewareIdentityConfig()
	cfg.SessionRenewAfter = 5 * time.Minute
	service := newMiddlewareIdentityService(cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)
	originalSessionID := issueMiddlewareSession(t, service)
	clock.Advance(cfg.SessionRenewAfter)

	router := gin.New()
	router.Use(RequireIdentity(service))
	router.GET("/protected", protectedHandler)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, middlewareRequestWithCookie(cfg.SessionCookieName, originalSessionID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("protected status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if got := len(recorder.Header().Values("Set-Cookie")); got != 1 {
		t.Fatalf("set-cookie count = %d, want 1; headers=%v", got, recorder.Header().Values("Set-Cookie"))
	}
	if cookie := middlewareResponseCookie(t, recorder, cfg.SessionCookieName); cookie.Value == originalSessionID {
		t.Fatalf("rotated session cookie was not replaced: %q", cookie.Value)
	}
}

func TestRequireIdentityFailsClosedWhenSessionStoreUnavailable(t *testing.T) {
	clock := &middlewareClock{now: time.Date(2026, 8, 11, 12, 30, 0, 0, time.UTC)}
	cfg := middlewareIdentityConfig()
	store := &unavailableMiddlewareStore{
		MemoryRecordStore: identity.NewMemoryRecordStore(clock.Now),
		getErr:            errors.New("record store disconnected"),
	}
	service := newMiddlewareIdentityService(cfg, store, clock.Now)

	called := false
	router := gin.New()
	router.Use(RequireIdentity(service))
	router.GET("/protected", func(c *gin.Context) {
		called = true
		protectedHandler(c)
	})
	request := middlewareRequestWithCookie(cfg.SessionCookieName, "opaque-session")
	request.Header.Set("X-Axi-Development-Subject", "development-user")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("protected status = %d, want %d; body=%s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
	}
	if called {
		t.Fatal("protected handler ran after unavailable session store")
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode unavailable response: %v", err)
	}
	if response["error"] != "session store unavailable" {
		t.Fatalf("unavailable response = %#v", response)
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("unavailable middleware changed cookies: %v", got)
	}
}

func TestRequireIdentityFallsBackToDevelopmentHeaderAfterInvalidCookie(t *testing.T) {
	clock := &middlewareClock{now: time.Date(2026, 8, 11, 12, 45, 0, 0, time.UTC)}
	cfg := middlewareIdentityConfig()
	service := newMiddlewareIdentityService(cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)

	router := gin.New()
	router.Use(RequireIdentity(service))
	router.GET("/protected", protectedHandler)
	request := middlewareRequestWithCookie(cfg.SessionCookieName, "expired-session")
	request.Header.Set("X-Axi-Development-Subject", "development-user")
	request.Header.Set("X-Axi-Development-Email", "developer@axi.test")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("development fallback status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode fallback response: %v", err)
	}
	if response["subject"] != "development-user" {
		t.Fatalf("development fallback response = %#v", response)
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("development fallback changed cookies: %v", got)
	}
}

func TestRequireIdentityFallsBackToBearerAfterInvalidCookie(t *testing.T) {
	clock := &middlewareClock{now: time.Date(2026, 8, 11, 13, 0, 0, 0, time.UTC)}
	cfg := middlewareIdentityConfig()
	service := identity.NewForTest(cfg, identity.NewMemoryRecordStore(clock.Now), middlewareBearerOIDCClient{}, clock.Now)

	router := gin.New()
	router.Use(RequireIdentity(service))
	router.GET("/protected", protectedHandler)
	request := middlewareRequestWithCookie(cfg.SessionCookieName, "expired-session")
	request.Header.Set("Authorization", "Bearer valid-bearer")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("bearer fallback status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode bearer fallback response: %v", err)
	}
	if response["subject"] != "bearer-user" {
		t.Fatalf("bearer fallback response = %#v", response)
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("bearer fallback changed cookies: %v", got)
	}
}
