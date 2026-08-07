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
	ErrUnauthorized = errors.New("gateway identity is not authenticated")
	ErrUnavailable  = errors.New("gateway OIDC identity is not configured")
)

type Principal struct {
	Subject string `json:"subject"`
	Email   string `json:"email,omitempty"`
	Name    string `json:"name,omitempty"`
}

type browserSession struct {
	Principal    Principal `json:"principal"`
	AccessToken  string    `json:"accessToken,omitempty"`
	RefreshToken string    `json:"refreshToken,omitempty"`
	ExpiresAt    time.Time `json:"expiresAt"`
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
	if cfg.RedisURL == "" {
		records = NewMemoryRecordStore(nil)
	} else {
		redisStore, err := NewRedisRecordStore(cfg.RedisURL)
		if err != nil {
			return nil, fmt.Errorf("create gateway Redis store: %w", err)
		}
		records = redisStore
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
	if records == nil {
		records = NewMemoryRecordStore(now)
	}
	if now == nil {
		now = time.Now
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
	if session.ExpiresAt.IsZero() || session.ExpiresAt.After(s.now().Add(s.config.SessionTTL)) {
		session.ExpiresAt = s.now().Add(s.config.SessionTTL)
	}
	sessionID, err := opaqueValue()
	if err != nil {
		return "", browserSession{}, "", err
	}
	encoded, err := json.Marshal(session)
	if err != nil {
		return "", browserSession{}, "", err
	}
	ttl := session.ExpiresAt.Sub(s.now())
	if ttl <= 0 {
		return "", browserSession{}, "", ErrUnauthorized
	}
	if err := s.records.Set(ctx, sessionKey(sessionID), encoded, ttl); err != nil {
		return "", browserSession{}, "", err
	}
	return sessionID, session, transaction.ReturnTo, nil
}

func (s *Service) Authenticate(ctx context.Context, request *http.Request) (Principal, error) {
	if sessionID, err := request.Cookie(s.config.SessionCookieName); err == nil && sessionID.Value != "" {
		record, err := s.records.Get(ctx, sessionKey(sessionID.Value))
		if err == nil {
			var session browserSession
			if json.Unmarshal(record, &session) == nil && session.Principal.Subject != "" && s.now().Before(session.ExpiresAt) {
				return session.Principal, nil
			}
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
	return Principal{}, ErrUnauthorized
}

func (s *Service) Logout(ctx context.Context, request *http.Request) error {
	cookie, err := request.Cookie(s.config.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return nil
	}
	return s.records.Delete(ctx, sessionKey(cookie.Value))
}

func (s *Service) SetCookie(response http.ResponseWriter, sessionID string) {
	http.SetCookie(response, &http.Cookie{
		Name:     s.config.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Domain:   s.config.SessionCookieDomain,
		MaxAge:   int(s.config.SessionTTL.Seconds()),
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
