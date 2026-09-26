package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type handlerClock struct {
	now time.Time
}

func (c *handlerClock) Now() time.Time {
	return c.now
}

func (c *handlerClock) Advance(duration time.Duration) {
	c.now = c.now.Add(duration)
}

func handlerIdentityConfig() config.IdentityConfig {
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

func newHandlerIdentityService(t *testing.T, cfg config.IdentityConfig, store identity.RecordStore, now func() time.Time) *identity.Service {
	t.Helper()
	return identity.NewForTest(cfg, store, nil, now)
}

func issueHandlerSession(t *testing.T, service *identity.Service) string {
	t.Helper()
	sessionID, err := service.IssueEmailSession(context.Background(), "owner@axi.test")
	if err != nil {
		t.Fatalf("issue browser session: %v", err)
	}
	return sessionID
}

func requestWithSessionCookie(method, path, cookieName, sessionID string) *http.Request {
	request := httptest.NewRequest(method, path, nil)
	request.AddCookie(&http.Cookie{Name: cookieName, Value: sessionID})
	return request
}

func responseCookie(t *testing.T, recorder *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("response did not set %q cookie: %v", name, recorder.Header().Values("Set-Cookie"))
	return nil
}

func passwordHash(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("generate password hash: %v", err)
	}
	return string(hash)
}

func decodeSessionResponse(t *testing.T, recorder *httptest.ResponseRecorder) struct {
	Authenticated bool               `json:"authenticated"`
	User          identity.Principal `json:"user"`
} {
	t.Helper()
	var response struct {
		Authenticated bool               `json:"authenticated"`
		User          identity.Principal `json:"user"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode session response: %v", err)
	}
	return response
}

func TestPasswordLoginIssuesBrowserSession(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 14, 1, 0, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	cfg.PasswordLoginOwnerEmail = "owner@axi.test"
	cfg.PasswordLoginSubject = "owner-password-subject"
	cfg.PasswordLoginPasswordHash = passwordHash(t, "correct-password")
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)

	router := gin.New()
	router.POST("/api/v1/auth/login/password", PasswordLogin(service))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login/password", bytes.NewBufferString(`{"email":"OWNER@AXI.TEST","password":"correct-password"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("password login status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	response := decodeSessionResponse(t, recorder)
	if !response.Authenticated || response.User.Subject != "owner-password-subject" {
		t.Fatalf("password login response = %#v", response)
	}
	cookie := responseCookie(t, recorder, cfg.SessionCookieName)
	if cookie.Value == "" || !cookie.HttpOnly {
		t.Fatalf("password login cookie = %#v", cookie)
	}
	principal, _, err := service.RestoreSession(context.Background(), requestWithSessionCookie(http.MethodGet, "/api/v1/auth/session", cfg.SessionCookieName, cookie.Value))
	if err != nil || principal.Subject != "owner-password-subject" {
		t.Fatalf("restore password session = %#v, %v", principal, err)
	}
}

func TestPasswordLoginRejectsInvalidCredentialsWithoutCookie(t *testing.T) {
	cfg := handlerIdentityConfig()
	cfg.PasswordLoginOwnerEmail = "owner@axi.test"
	cfg.PasswordLoginSubject = "owner-password-subject"
	cfg.PasswordLoginPasswordHash = passwordHash(t, "correct-password")
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(nil), nil)

	router := gin.New()
	router.POST("/api/v1/auth/login/password", PasswordLogin(service))
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login/password", bytes.NewBufferString(`{"email":"owner@axi.test","password":"wrong-password"}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("invalid password status = %d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("invalid password set cookies: %v", got)
	}
}

func TestAuthMethodsReportsConfiguredPasswordLogin(t *testing.T) {
	cfg := handlerIdentityConfig()
	cfg.PasswordLoginOwnerEmail = "owner@axi.test"
	cfg.PasswordLoginSubject = "owner-password-subject"
	cfg.PasswordLoginPasswordHash = passwordHash(t, "correct-password")
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(nil), nil)

	router := gin.New()
	router.GET("/api/v1/auth/methods", AuthMethods(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/auth/methods", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("auth methods status = %d, want %d", recorder.Code, http.StatusOK)
	}
	var response struct {
		EmailLogin    bool `json:"emailLogin"`
		PasswordLogin bool `json:"passwordLogin"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode auth methods: %v", err)
	}
	if !response.EmailLogin || !response.PasswordLogin {
		t.Fatalf("auth methods = %#v", response)
	}
}

type unavailableHandlerStore struct {
	*identity.MemoryRecordStore
	getErr error
}

func (s *unavailableHandlerStore) Get(ctx context.Context, key string) ([]byte, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	return s.MemoryRecordStore.Get(ctx, key)
}

type sequenceHandlerStore struct {
	*identity.MemoryRecordStore
	getCalls int
}

func (s *sequenceHandlerStore) Get(context.Context, string) ([]byte, error) {
	s.getCalls++
	if s.getCalls == 1 {
		return nil, identity.ErrRecordNotFound
	}
	return nil, errors.New("unexpected second session-store read")
}

func TestSessionRestoresBrowserCookieAndRefreshesCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 10, 0, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)
	sessionID := issueHandlerSession(t, service)

	router := gin.New()
	router.GET("/api/v1/auth/session", Session(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, requestWithSessionCookie(http.MethodGet, "/api/v1/auth/session", cfg.SessionCookieName, sessionID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("session status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	response := decodeSessionResponse(t, recorder)
	if !response.Authenticated || response.User.Subject != "owner-subject" {
		t.Fatalf("session response = %#v", response)
	}
	if cookie := responseCookie(t, recorder, cfg.SessionCookieName); cookie.Value != sessionID {
		t.Fatalf("refreshed session cookie = %q, want %q", cookie.Value, sessionID)
	}
}

func TestSessionReturnsServiceUnavailableWithoutChangingCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 10, 15, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	store := &unavailableHandlerStore{
		MemoryRecordStore: identity.NewMemoryRecordStore(clock.Now),
		getErr:            errors.New("record store disconnected"),
	}
	service := newHandlerIdentityService(t, cfg, store, clock.Now)

	router := gin.New()
	router.GET("/api/v1/auth/session", Session(service))
	recorder := httptest.NewRecorder()
	request := requestWithSessionCookie(http.MethodGet, "/api/v1/auth/session", cfg.SessionCookieName, "opaque-session")
	request.Header.Set("X-Axi-Development-Subject", "development-user")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("session status = %d, want %d; body=%s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
	}
	var response map[string]string
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode unavailable response: %v", err)
	}
	if response["error"] != "session store unavailable" {
		t.Fatalf("unavailable response = %#v", response)
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("unavailable session changed cookies: %v", got)
	}
}

func TestSessionFallsBackToDevelopmentHeaderAfterInvalidCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 10, 30, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	store := &sequenceHandlerStore{MemoryRecordStore: identity.NewMemoryRecordStore(clock.Now)}
	service := newHandlerIdentityService(t, cfg, store, clock.Now)

	router := gin.New()
	router.GET("/api/v1/auth/session", Session(service))
	request := requestWithSessionCookie(http.MethodGet, "/api/v1/auth/session", cfg.SessionCookieName, "expired-session")
	request.Header.Set("X-Axi-Development-Subject", "development-user")
	request.Header.Set("X-Axi-Development-Email", "developer@axi.test")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("session fallback status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	response := decodeSessionResponse(t, recorder)
	if !response.Authenticated || response.User.Subject != "development-user" {
		t.Fatalf("session fallback response = %#v", response)
	}
	if store.getCalls != 1 {
		t.Fatalf("session-store reads = %d, want 1", store.getCalls)
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("development fallback changed cookies: %v", got)
	}
}

func TestSessionUsesMiddlewarePrincipalWithoutSecondRestore(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 10, 45, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	cfg.SessionRenewAfter = 5 * time.Minute
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)
	originalSessionID := issueHandlerSession(t, service)
	clock.Advance(cfg.SessionRenewAfter)

	router := gin.New()
	router.Use(middleware.RequireIdentity(service))
	router.GET("/users/me", Session(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, requestWithSessionCookie(http.MethodGet, "/users/me", cfg.SessionCookieName, originalSessionID))

	if recorder.Code != http.StatusOK {
		t.Fatalf("protected session status = %d, want %d; body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	response := decodeSessionResponse(t, recorder)
	if !response.Authenticated || response.User.Subject != "owner-subject" {
		t.Fatalf("protected session response = %#v", response)
	}
	if got := len(recorder.Header().Values("Set-Cookie")); got != 1 {
		t.Fatalf("protected session set-cookie count = %d, want 1; headers=%v", got, recorder.Header().Values("Set-Cookie"))
	}
	if cookie := responseCookie(t, recorder, cfg.SessionCookieName); cookie.Value == originalSessionID {
		t.Fatalf("rotated session cookie was not replaced: %q", cookie.Value)
	}
}

func TestLogoutStoreUnavailableDoesNotClearCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 11, 0, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	store := &unavailableHandlerStore{
		MemoryRecordStore: identity.NewMemoryRecordStore(clock.Now),
		getErr:            errors.New("record store disconnected"),
	}
	service := newHandlerIdentityService(t, cfg, store, clock.Now)

	router := gin.New()
	router.POST("/api/v1/auth/logout", Logout(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, requestWithSessionCookie(http.MethodPost, "/api/v1/auth/logout", cfg.SessionCookieName, "opaque-session"))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("logout status = %d, want %d; body=%s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
	}
	if got := recorder.Header().Values("Set-Cookie"); len(got) != 0 {
		t.Fatalf("unavailable logout changed cookies: %v", got)
	}
}

func TestLogoutMissingSessionClearsCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 11, 15, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)

	router := gin.New()
	router.POST("/api/v1/auth/logout", Logout(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, requestWithSessionCookie(http.MethodPost, "/api/v1/auth/logout", cfg.SessionCookieName, "already-gone"))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("logout status = %d, want %d; body=%s", recorder.Code, http.StatusNoContent, recorder.Body.String())
	}
	cookie := responseCookie(t, recorder, cfg.SessionCookieName)
	if cookie.Value != "" || cookie.MaxAge >= 0 {
		t.Fatalf("cleared session cookie = %#v", cookie)
	}
}

func TestLogoutWithoutSessionCookieClearsCookie(t *testing.T) {
	clock := &handlerClock{now: time.Date(2026, 8, 11, 11, 30, 0, 0, time.UTC)}
	cfg := handlerIdentityConfig()
	service := newHandlerIdentityService(t, cfg, identity.NewMemoryRecordStore(clock.Now), clock.Now)

	router := gin.New()
	router.POST("/api/v1/auth/logout", Logout(service))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("logout status = %d, want %d; body=%s", recorder.Code, http.StatusNoContent, recorder.Body.String())
	}
	cookie := responseCookie(t, recorder, cfg.SessionCookieName)
	if cookie.Value != "" || cookie.MaxAge >= 0 {
		t.Fatalf("cleared session cookie = %#v", cookie)
	}
}
