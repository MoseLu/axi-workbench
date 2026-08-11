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

func New(ctx context.Context, cfg config.IdentityConfig) (*Service, error) {
	var records RecordStore
	redisURL := strings.TrimSpace(cfg.RedisURL)
	if cfg.RequireDurableSessionStore && redisURL == "" {
		return nil, errors.New("gateway durable session store requires Redis configuration")
	}
	if redisURL == "" {
		records = NewMemoryRecordStore(nil)
	} else {
		redisStore, err := NewRedisRecordStore(redisURL)
		if err != nil {
			return nil, fmt.Errorf("%w: Redis configuration is invalid", ErrSessionStoreUnavailable)
		}
		records = redisStore
		if cfg.RequireDurableSessionStore {
			if err := records.Ping(ctx); err != nil {
				_ = records.Close()
				return nil, fmt.Errorf("%w: durable session store ping failed", ErrSessionStoreUnavailable)
			}
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

func (s *Service) Authenticate(ctx context.Context, request *http.Request) (Principal, error) {
	var sessionStoreErr error
	if request != nil {
		if sessionID, err := request.Cookie(s.config.SessionCookieName); err == nil && sessionID.Value != "" {
			session, err := s.loadSession(ctx, sessionID.Value, s.now())
			if err == nil {
				return session.Principal, nil
			}
			if errors.Is(err, ErrSessionStoreUnavailable) {
				sessionStoreErr = err
			}
		}
		if authorization := request.Header.Get("Authorization"); strings.HasPrefix(strings.ToLower(authorization), "bearer ") && s.client != nil {
			return s.client.VerifyBearer(ctx, strings.TrimSpace(authorization[7:]))
		}
		if s.config.DevelopmentHeaderAuth {
			if subject := strings.TrimSpace(request.Header.Get("X-Axi-Development-Subject")); subject != "" {
				return Principal{Subject: subject, Email: strings.TrimSpace(request.Header.Get("X-Axi-Development-Email"))}, nil
			}
		}
	}
	if sessionStoreErr != nil {
		return Principal{}, sessionStoreErr
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
	session, err := s.loadSession(ctx, cookie.Value, now)
	if err != nil {
		return Principal{}, "", err
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
		if err := s.records.Rotate(ctx, sessionKey(cookie.Value), sessionKey(newSessionID), encoded, ttl); err != nil {
			if errors.Is(err, ErrRecordNotFound) {
				return Principal{}, "", ErrUnauthorized
			}
			return Principal{}, "", ErrSessionStoreUnavailable
		}
		return session.Principal, newSessionID, nil
	}
	if err := s.records.Set(ctx, sessionKey(cookie.Value), encoded, ttl); err != nil {
		return Principal{}, "", ErrSessionStoreUnavailable
	}
	return session.Principal, cookie.Value, nil
}

func (s *Service) Logout(ctx context.Context, request *http.Request) error {
	cookie, err := request.Cookie(s.config.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}
	return s.records.Delete(ctx, sessionKey(cookie.Value))
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

func (s *Service) loadSession(ctx context.Context, sessionID string, now time.Time) (browserSession, error) {
	record, err := s.records.Get(ctx, sessionKey(sessionID))
	if errors.Is(err, ErrRecordNotFound) {
		return browserSession{}, ErrUnauthorized
	}
	if err != nil {
		return browserSession{}, ErrSessionStoreUnavailable
	}
	var session browserSession
	if err := json.Unmarshal(record, &session); err != nil || !session.validAt(now) {
		return browserSession{}, ErrUnauthorized
	}
	return session, nil
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
