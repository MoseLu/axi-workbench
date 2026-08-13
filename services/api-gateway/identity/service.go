package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/epap/api-gateway/config"
	"golang.org/x/oauth2"
)

var (
	ErrUnauthorized            = errors.New("gateway identity is not authenticated")
	ErrUnavailable             = errors.New("gateway OIDC identity is not configured")
	ErrSessionStoreUnavailable = errors.New("gateway identity session store is unavailable")
)

type Principal struct {
	Subject string `json:"subject"`
	Email   string `json:"email,omitempty"`
	Name    string `json:"name,omitempty"`
}

type browserSession struct {
	Principal     Principal `json:"principal"`
	AccessToken   string    `json:"accessToken,omitempty"`
	RefreshToken  string    `json:"refreshToken,omitempty"`
	ExpiresAt     time.Time `json:"expiresAt"`
	IdleExpiresAt time.Time `json:"idleExpiresAt"`
	LastSeenAt    time.Time `json:"lastSeenAt"`
	RenewedAt     time.Time `json:"renewedAt"`
}

// sessionTombstone replaces a rotated session record. It is deliberately not a
// browserSession: a predecessor cookie can never authenticate, but Logout can
// use the private successor pointer to revoke the current session after a
// cookie refresh race.
type sessionTombstone struct {
	SupersededBy string `json:"supersededBy"`
}

type authorizationTransaction struct {
	CodeVerifier string `json:"codeVerifier"`
	Nonce        string `json:"nonce"`
	ReturnTo     string `json:"returnTo"`
}

type oidcClient interface {
	AuthorizationURL(state, verifier, nonce string) string
	Exchange(context.Context, string, authorizationTransaction) (browserSession, error)
	VerifyBearer(context.Context, string) (Principal, error)
}

type Service struct {
	config  config.IdentityConfig
	records RecordStore
	client  oidcClient
	now     func() time.Time
}

// newRedisRecordStore is a narrow construction seam for startup checks. It is
// kept package-local so tests can prove fail-fast behavior without requiring a
// reachable Redis server. New snapshots it under the mutex and invokes the
// snapshot after unlocking so a factory cannot hold the write lock while it
// performs network work.
var (
	newRedisRecordStoreMu sync.RWMutex
	newRedisRecordStore   = func(redisURL string) (RecordStore, error) {
		return NewRedisRecordStore(redisURL)
	}
)

func New(ctx context.Context, cfg config.IdentityConfig) (*Service, error) {
	var records RecordStore
	redisURL := strings.TrimSpace(cfg.RedisURL)
	if cfg.RequireDurableSessionStore && redisURL == "" {
		return nil, errors.New("gateway durable session store requires Redis configuration")
	}
	if redisURL == "" {
		records = NewMemoryRecordStore(nil)
	} else {
		newRedisRecordStoreMu.RLock()
		redisStoreFactory := newRedisRecordStore
		newRedisRecordStoreMu.RUnlock()
		redisStore, err := redisStoreFactory(redisURL)
		if err != nil {
			return nil, fmt.Errorf("%w: Redis configuration is invalid", ErrSessionStoreUnavailable)
		}
		records = redisStore
		if err := records.Ping(ctx); err != nil {
			_ = records.Close()
			return nil, fmt.Errorf("%w: session store ping failed", ErrSessionStoreUnavailable)
		}
	}
	service := &Service{config: cfg, records: records, now: time.Now}
	if cfg.IssuerURL == "" || cfg.ClientID == "" {
		return service, nil
	}
	client, err := newOIDCClient(ctx, cfg)
	if err != nil {
		records.Close()
		return nil, err
	}
	service.client = client
	return service, nil
}

func NewForTest(cfg config.IdentityConfig, records RecordStore, client oidcClient, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	if records == nil {
		records = NewMemoryRecordStore(now)
	}
	return &Service{config: cfg, records: records, client: client, now: now}
}

func (s *Service) Close() error                    { return s.records.Close() }
func (s *Service) Ready(ctx context.Context) error { return s.records.Ping(ctx) }

func (s *Service) Begin(ctx context.Context, returnTo string) (string, error) {
	if s.client == nil {
		return "", ErrUnavailable
	}
	if !s.validReturnTo(returnTo) {
		return "", fmt.Errorf("invalid post-login return URL")
	}
	state, err := opaqueValue()
	if err != nil {
		return "", err
	}
	verifier, err := opaqueValue()
	if err != nil {
		return "", err
	}
	nonce, err := opaqueValue()
	if err != nil {
		return "", err
	}
	record, err := json.Marshal(authorizationTransaction{CodeVerifier: verifier, Nonce: nonce, ReturnTo: returnTo})
	if err != nil {
		return "", err
	}
	if err := s.records.Set(ctx, stateKey(state), record, 10*time.Minute); err != nil {
		return "", err
	}
	return s.client.AuthorizationURL(state, verifier, nonce), nil
}

func (s *Service) Complete(ctx context.Context, state, code string) (string, browserSession, string, error) {
	if s.client == nil {
		return "", browserSession{}, "", ErrUnavailable
	}
	record, err := s.records.Get(ctx, stateKey(state))
	if err != nil {
		return "", browserSession{}, "", ErrUnauthorized
	}
	// State is single use even if the following token exchange fails.
	if err := s.records.Delete(ctx, stateKey(state)); err != nil {
		return "", browserSession{}, "", err
	}
	var transaction authorizationTransaction
	if err := json.Unmarshal(record, &transaction); err != nil {
		return "", browserSession{}, "", err
	}
	session, err := s.client.Exchange(ctx, code, transaction)
	if err != nil {
		return "", browserSession{}, "", err
	}
	if session.Principal.Subject == "" {
		return "", browserSession{}, "", ErrUnauthorized
	}
	now := s.now()
	session, err = s.initializeSession(session, now)
	if err != nil {
		return "", browserSession{}, "", err
	}
	sessionID, err := opaqueValue()
	if err != nil {
		return "", browserSession{}, "", err
	}
	if err := s.persistSession(ctx, sessionID, session, now); err != nil {
		return "", browserSession{}, "", err
	}
	return sessionID, session, transaction.ReturnTo, nil
}

// Authenticate restores a browser session before considering header
// credentials. A durable-session store failure is terminal: it must not be
// bypassed by a bearer token or development header carried on the same request.
func (s *Service) Authenticate(ctx context.Context, request *http.Request) (Principal, error) {
	if request == nil {
		return Principal{}, ErrUnauthorized
	}
	if sessionID, err := request.Cookie(s.config.SessionCookieName); err == nil && sessionID.Value != "" {
		session, _, err := s.loadSession(ctx, sessionID.Value, s.now())
		if err == nil {
			return session.Principal, nil
		}
		if !errors.Is(err, ErrUnauthorized) {
			return Principal{}, err
		}
	}
	return s.AuthenticateHeaderCredentials(ctx, request.Header)
}

// AuthenticateHeaderCredentials verifies only bearer and development-header
// credentials. It accepts http.Header rather than *http.Request so callers
// that have already attempted RestoreSession cannot accidentally issue a
// second browser-cookie or session-store read during fallback.
func (s *Service) AuthenticateHeaderCredentials(ctx context.Context, header http.Header) (Principal, error) {
	if authorization := header.Get("Authorization"); strings.HasPrefix(strings.ToLower(authorization), "bearer ") && s.client != nil {
		return s.client.VerifyBearer(ctx, strings.TrimSpace(authorization[7:]))
	}
	if s.config.DevelopmentHeaderAuth {
		if subject := strings.TrimSpace(header.Get("X-Axi-Development-Subject")); subject != "" {
			return Principal{Subject: subject, Email: strings.TrimSpace(header.Get("X-Axi-Development-Email"))}, nil
		}
	}
	return Principal{}, ErrUnauthorized
}

// RestoreSession validates and refreshes a browser cookie session. It returns
// the session ID that a handler should place back in the cookie; that ID may
// change when the configured renewal interval is reached.
func (s *Service) RestoreSession(ctx context.Context, request *http.Request) (Principal, string, error) {
	if request == nil {
		return Principal{}, "", ErrUnauthorized
	}
	cookie, err := request.Cookie(s.config.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return Principal{}, "", ErrUnauthorized
	}
	now := s.now()
	session, expected, err := s.loadSession(ctx, cookie.Value, now)
	if err != nil {
		return Principal{}, "", err
	}
	if session.IdleExpiresAt.IsZero() {
		// Records serialized before idle/session renewal existed must remain
		// bounded by their original ExpiresAt. Returning them without a write
		// preserves both the legacy payload and its original store TTL.
		return session.Principal, cookie.Value, nil
	}
	policy, err := s.sessionPolicy()
	if err != nil {
		return Principal{}, "", err
	}

	session.LastSeenAt = now
	session.IdleExpiresAt = minTime(now.Add(policy.idleTTL), session.ExpiresAt)
	if !now.Before(session.IdleExpiresAt) {
		return Principal{}, "", ErrUnauthorized
	}
	shouldRotate := false
	if session.RenewedAt.IsZero() {
		// Legacy sessions did not record a renewal time. Initialize it on their
		// first successful restore without moving the absolute expiry.
		session.RenewedAt = now
	} else if s.config.SessionRenewAfter > 0 && !now.Before(session.RenewedAt.Add(s.config.SessionRenewAfter)) {
		session.RenewedAt = now
		shouldRotate = true
	}
	encoded, err := json.Marshal(session)
	if err != nil {
		return Principal{}, "", err
	}
	ttl := session.IdleExpiresAt.Sub(now)
	if ttl <= 0 {
		return Principal{}, "", ErrUnauthorized
	}
	if shouldRotate {
		newSessionID, err := opaqueValue()
		if err != nil {
			return Principal{}, "", err
		}
		tombstone, err := json.Marshal(sessionTombstone{SupersededBy: newSessionID})
		if err != nil {
			return Principal{}, "", err
		}
		tombstoneTTL := session.ExpiresAt.Sub(now)
		if tombstoneTTL <= 0 {
			return Principal{}, "", ErrUnauthorized
		}
		if err := s.records.Rotate(ctx, sessionKey(cookie.Value), expected, sessionKey(newSessionID), encoded, ttl, tombstone, tombstoneTTL); err != nil {
			if errors.Is(err, ErrRecordNotFound) {
				return Principal{}, "", ErrUnauthorized
			}
			return Principal{}, "", ErrSessionStoreUnavailable
		}
		return session.Principal, newSessionID, nil
	}
	if err := s.records.CompareAndSet(ctx, sessionKey(cookie.Value), expected, encoded, ttl); err != nil {
		if errors.Is(err, ErrRecordNotFound) {
			return Principal{}, "", ErrUnauthorized
		}
		return Principal{}, "", ErrSessionStoreUnavailable
	}
	return session.Principal, cookie.Value, nil
}

func (s *Service) Logout(ctx context.Context, request *http.Request) error {
	if request == nil {
		return nil
	}
	cookie, err := request.Cookie(s.config.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}
	return s.revokeSession(ctx, cookie.Value)
}

// revokeSession invalidates a cookie's active record, following predecessor
// tombstones created by rotation. A conditional delete means a concurrent
// rotation cannot be missed: if it wins first, the next read observes its
// tombstone and follows the new successor; if Logout wins first, Rotate's
// expected-value check fails and cannot create a successor.
func (s *Service) revokeSession(ctx context.Context, sessionID string) error {
	currentID := sessionID
	followedTombstone := false
	visited := make(map[string]struct{})
	for {
		if currentID == "" {
			return ErrSessionStoreUnavailable
		}
		if _, seen := visited[currentID]; seen {
			// A malformed/cyclic record must not authenticate or cause writes.
			return ErrSessionStoreUnavailable
		}
		visited[currentID] = struct{}{}

		record, err := s.records.Get(ctx, sessionKey(currentID))
		if errors.Is(err, ErrRecordNotFound) {
			if followedTombstone {
				// An original cookie can be idempotently absent, but a missing
				// successor means a rotation chain is incomplete and must not be
				// reported as a successful revocation.
				return ErrSessionStoreUnavailable
			}
			return nil
		}
		if err != nil {
			return ErrSessionStoreUnavailable
		}

		var fields map[string]json.RawMessage
		if err := json.Unmarshal(record, &fields); err != nil || fields == nil {
			return ErrSessionStoreUnavailable
		}
		if _, isTombstone := fields["supersededBy"]; isTombstone {
			var tombstone sessionTombstone
			if err := json.Unmarshal(record, &tombstone); err != nil {
				return ErrSessionStoreUnavailable
			}
			currentID = strings.TrimSpace(tombstone.SupersededBy)
			if currentID == "" {
				return ErrSessionStoreUnavailable
			}
			followedTombstone = true
			continue
		}

		var session browserSession
		if err := json.Unmarshal(record, &session); err != nil || session.Principal.Subject == "" {
			// Do not interpret malformed records as a successor and never create
			// new state while attempting to log out.
			return ErrSessionStoreUnavailable
		}
		if err := s.records.CompareAndDelete(ctx, sessionKey(currentID), record); err == nil {
			return nil
		} else if errors.Is(err, ErrRecordNotFound) {
			// The record was deleted or rotated after Get. Re-read this same key;
			// a winning Rotate left a tombstone pointing at its successor.
			delete(visited, currentID)
			continue
		} else {
			return ErrSessionStoreUnavailable
		}
	}
}

func (s *Service) SetCookie(response http.ResponseWriter, sessionID string) {
	maxAge := 0
	if policy, err := s.sessionPolicy(); err == nil {
		maxAge = int(policy.idleTTL.Seconds())
	}
	http.SetCookie(response, &http.Cookie{
		Name:     s.config.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Domain:   s.config.SessionCookieDomain,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.config.SessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) ClearCookie(response http.ResponseWriter) {
	http.SetCookie(response, &http.Cookie{
		Name:     s.config.SessionCookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.config.SessionCookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.config.SessionCookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

type sessionPolicy struct {
	idleTTL     time.Duration
	absoluteTTL time.Duration
}

func (s *Service) sessionPolicy() (sessionPolicy, error) {
	legacyTTL := s.config.SessionTTL
	if legacyTTL <= 0 {
		return sessionPolicy{}, errors.New("gateway session TTL must be positive")
	}
	absoluteTTL := s.config.SessionAbsoluteTTL
	if absoluteTTL <= 0 {
		absoluteTTL = legacyTTL
	}
	idleTTL := s.config.SessionIdleTTL
	if idleTTL <= 0 {
		idleTTL = legacyTTL
	}
	if idleTTL > absoluteTTL {
		idleTTL = absoluteTTL
	}
	return sessionPolicy{idleTTL: idleTTL, absoluteTTL: absoluteTTL}, nil
}

func (s *Service) initializeSession(session browserSession, now time.Time) (browserSession, error) {
	policy, err := s.sessionPolicy()
	if err != nil {
		return browserSession{}, err
	}
	session.ExpiresAt = now.Add(policy.absoluteTTL)
	session.IdleExpiresAt = minTime(now.Add(policy.idleTTL), session.ExpiresAt)
	session.LastSeenAt = now
	session.RenewedAt = now
	return session, nil
}

func (s *Service) persistSession(ctx context.Context, sessionID string, session browserSession, now time.Time) error {
	encoded, err := json.Marshal(session)
	if err != nil {
		return err
	}
	ttl := session.IdleExpiresAt.Sub(now)
	if ttl <= 0 {
		return ErrUnauthorized
	}
	if err := s.records.Set(ctx, sessionKey(sessionID), encoded, ttl); err != nil {
		return ErrSessionStoreUnavailable
	}
	return nil
}

func (s *Service) loadSession(ctx context.Context, sessionID string, now time.Time) (browserSession, []byte, error) {
	record, err := s.records.Get(ctx, sessionKey(sessionID))
	if errors.Is(err, ErrRecordNotFound) {
		return browserSession{}, nil, ErrUnauthorized
	}
	if err != nil {
		return browserSession{}, nil, ErrSessionStoreUnavailable
	}
	var session browserSession
	if err := json.Unmarshal(record, &session); err != nil || !session.validAt(now) {
		return browserSession{}, nil, ErrUnauthorized
	}
	return session, record, nil
}

func (session browserSession) validAt(now time.Time) bool {
	return session.Principal.Subject != "" &&
		!session.ExpiresAt.IsZero() &&
		now.Before(session.ExpiresAt) &&
		now.Before(session.effectiveIdleExpiresAt())
}

func (session browserSession) effectiveIdleExpiresAt() time.Time {
	if session.IdleExpiresAt.IsZero() {
		// Serialized sessions from before the idle policy only had ExpiresAt.
		// Treat that timestamp as their idle deadline so an old session can
		// never be extended beyond its pre-existing lifetime.
		return session.ExpiresAt
	}
	return session.IdleExpiresAt
}

func minTime(first, second time.Time) time.Time {
	if second.Before(first) {
		return second
	}
	return first
}

func (s *Service) validReturnTo(value string) bool {
	if value == "" {
		return false
	}
	if strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//") && !strings.ContainsAny(value, "\r\n") {
		return true
	}
	for _, allowed := range s.config.AllowedReturnURLs {
		if value == allowed {
			return true
		}
	}
	return false
}

func stateKey(state string) string { return "axi:oidc:state:" + state }
func sessionKey(id string) string  { return "axi:session:" + id }

func opaqueValue() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// EmailLoginPrincipal maps the single personal-owner email factor to the
// configured canonical subject. It deliberately refuses arbitrary email
// addresses when EMAIL_LOGIN_OWNER_EMAIL is configured; email OTP is a factor
// for the owner, not an account-creation mechanism.
func (s *Service) EmailLoginPrincipal(email string) (Principal, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return Principal{}, errors.New("email is required")
	}
	owner := strings.TrimSpace(strings.ToLower(s.config.EmailLoginOwnerEmail))
	if owner == "" {
		return Principal{}, ErrUnavailable
	}
	if email != owner {
		return Principal{}, ErrUnauthorized
	}
	subject := strings.TrimSpace(s.config.EmailLoginSubject)
	if subject == "" {
		return Principal{}, ErrUnavailable
	}
	return Principal{Subject: subject, Email: email}, nil
}

// IssueEmailSession creates a browser session for a verified owner email
// address. The caller is responsible for proving email ownership through the
// identity-adapter challenge endpoint before invoking this method.
func (s *Service) IssueEmailSession(ctx context.Context, email string) (string, error) {
	principal, err := s.EmailLoginPrincipal(email)
	if err != nil {
		return "", err
	}
	return s.IssuePrincipalSession(ctx, principal)
}

// IssuePrincipalSession creates the same durable, renewable browser session
// used by OIDC and email login after an upstream trust boundary has already
// verified the principal. The Control Plane device-login grant is one such
// boundary: it only returns a subject from an active device explicitly bound
// to an existing browser owner. This method must never be called with browser
// supplied identity fields.
func (s *Service) IssuePrincipalSession(ctx context.Context, principal Principal) (string, error) {
	principal.Subject = strings.TrimSpace(principal.Subject)
	principal.Email = strings.TrimSpace(principal.Email)
	principal.Name = strings.TrimSpace(principal.Name)
	if principal.Subject == "" || len(principal.Subject) > 256 || len(principal.Email) > 320 || len(principal.Name) > 256 {
		return "", ErrUnauthorized
	}
	now := s.now()
	session, err := s.initializeSession(browserSession{Principal: principal}, now)
	if err != nil {
		return "", err
	}
	sessionID, err := opaqueValue()
	if err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	if err := s.persistSession(ctx, sessionID, session, now); err != nil {
		return "", fmt.Errorf("persist session: %w", err)
	}
	return sessionID, nil
}

type actualOIDCClient struct {
	config                    oauth2.Config
	idTokenVerifier           *oidc.IDTokenVerifier
	accessTokenVerifier       *oidc.IDTokenVerifier
	requiredAccessTokenScopes []string
}

func newOIDCClient(ctx context.Context, cfg config.IdentityConfig) (*actualOIDCClient, error) {
	provider, err := oidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("discover OIDC issuer: %w", err)
	}
	apiAudience := cfg.APIAudience
	if apiAudience == "" {
		// Keep local development backwards compatible while production
		// configuration requires an explicit resource-server audience.
		apiAudience = cfg.ClientID
	}
	return &actualOIDCClient{
		config: oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.CallbackURL,
			Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "offline_access"},
		},
		idTokenVerifier:           provider.Verifier(&oidc.Config{ClientID: cfg.ClientID}),
		accessTokenVerifier:       provider.Verifier(&oidc.Config{ClientID: apiAudience}),
		requiredAccessTokenScopes: append([]string(nil), cfg.RequiredAccessTokenScopes...),
	}, nil
}

func (c *actualOIDCClient) AuthorizationURL(state, verifier, nonce string) string {
	challenge := sha256.Sum256([]byte(verifier))
	return c.config.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("code_challenge", base64.RawURLEncoding.EncodeToString(challenge[:])),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		oauth2.SetAuthURLParam("nonce", nonce),
	)
}

func (c *actualOIDCClient) Exchange(ctx context.Context, code string, transaction authorizationTransaction) (browserSession, error) {
	token, err := c.config.Exchange(ctx, code, oauth2.VerifierOption(transaction.CodeVerifier))
	if err != nil {
		return browserSession{}, fmt.Errorf("OIDC code exchange: %w", err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return browserSession{}, ErrUnauthorized
	}
	idToken, err := c.idTokenVerifier.Verify(ctx, rawIDToken)
	if err != nil {
		return browserSession{}, fmt.Errorf("verify OIDC ID token: %w", err)
	}
	if idToken.Nonce != transaction.Nonce {
		return browserSession{}, ErrUnauthorized
	}
	principal, err := principalFromIDToken(idToken)
	if err != nil {
		return browserSession{}, err
	}
	return browserSession{
		Principal:    principal,
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		ExpiresAt:    token.Expiry,
	}, nil
}

func (c *actualOIDCClient) VerifyBearer(ctx context.Context, rawToken string) (Principal, error) {
	accessToken, err := c.accessTokenVerifier.Verify(ctx, rawToken)
	if err != nil {
		return Principal{}, ErrUnauthorized
	}
	var claims map[string]any
	if err := accessToken.Claims(&claims); err != nil || !claimsHaveRequiredScopes(claims, c.requiredAccessTokenScopes) {
		return Principal{}, ErrUnauthorized
	}
	return principalFromIDToken(accessToken)
}

func claimsHaveRequiredScopes(claims map[string]any, required []string) bool {
	if len(required) == 0 {
		return true
	}
	granted := make(map[string]struct{})
	for _, claim := range []string{"scope", "scp", "permissions"} {
		collectScopes(granted, claims[claim])
	}
	for _, scope := range required {
		if _, ok := granted[scope]; !ok {
			return false
		}
	}
	return true
}

func collectScopes(granted map[string]struct{}, value any) {
	switch scopes := value.(type) {
	case string:
		for _, scope := range strings.Fields(scopes) {
			granted[scope] = struct{}{}
		}
	case []string:
		for _, scope := range scopes {
			collectScopes(granted, scope)
		}
	case []any:
		for _, scope := range scopes {
			collectScopes(granted, scope)
		}
	}
}

func principalFromIDToken(token *oidc.IDToken) (Principal, error) {
	var claims struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := token.Claims(&claims); err != nil {
		return Principal{}, err
	}
	if token.Subject == "" {
		return Principal{}, ErrUnauthorized
	}
	return Principal{Subject: token.Subject, Email: claims.Email, Name: claims.Name}, nil
}

func ParseReturnTo(value string) string {
	decoded, err := url.QueryUnescape(value)
	if err != nil {
		return value
	}
	return decoded
}
