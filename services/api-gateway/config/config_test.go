package config

import (
	"strings"
	"testing"
	"time"
)

func productionConfigForTest() Config {
	return Config{
		Environment: "production",
		Identity: IdentityConfig{
			IssuerURL:                 "https://id.axi.example.com",
			ClientID:                  "axi-workbench-browser",
			APIAudience:               "axi-workbench-api",
			RequiredAccessTokenScopes: []string{"axi.api"},
			SessionTTL:                time.Hour,
			SessionIdleTTL:            time.Hour,
			SessionAbsoluteTTL:        time.Hour,
			SessionCookieSecure:       true,
			EmailLoginOwnerEmail:      "owner@example.com",
			EmailLoginSubject:         "owner-subject",
			RedisURL:                  "redis://gateway",
		},
		RateLimit: RateLimitConfig{RequestsPerMinute: 120},
		Services: ServicesConfig{
			IdentityInternalToken:     "identity-token",
			PlatformInternalToken:     "platform-token",
			PlatformOutboxToken:       "outbox-token",
			FileInternalToken:         "file-token",
			WorkflowInternalToken:     "workflow-token",
			NotificationInternalToken: "notification-token",
			ControlPlaneURL:           "http://control-plane.internal:8092",
			ControlPlaneInternalToken: "control-plane-token",
		},
		CORS: CORSConfig{AllowedOrigins: []string{"https://web.axi.example.com"}},
	}
}

func sessionConfigForTest() Config {
	return Config{
		Identity: IdentityConfig{
			SessionTTL:         time.Hour,
			SessionIdleTTL:     time.Hour,
			SessionAbsoluteTTL: time.Hour,
		},
		RateLimit: RateLimitConfig{RequestsPerMinute: 120},
	}
}

func TestLoadSessionPolicyFallsBackToLegacyTTL(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("SESSION_TTL", "3h")
	t.Setenv("SESSION_IDLE_TTL", "")
	t.Setenv("SESSION_ABSOLUTE_TTL", "")
	t.Setenv("SESSION_RENEW_AFTER", "")
	t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Identity.SessionIdleTTL != 3*time.Hour {
		t.Errorf("SessionIdleTTL = %s, want 3h", cfg.Identity.SessionIdleTTL)
	}
	if cfg.Identity.SessionAbsoluteTTL != 3*time.Hour {
		t.Errorf("SessionAbsoluteTTL = %s, want 3h", cfg.Identity.SessionAbsoluteTTL)
	}
	if cfg.Identity.SessionRenewAfter != 0 {
		t.Errorf("SessionRenewAfter = %s, want disabled (0)", cfg.Identity.SessionRenewAfter)
	}
}

func TestLoadSessionPolicyDefaultsToExistingEightHours(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("SESSION_TTL", "")
	t.Setenv("SESSION_IDLE_TTL", "")
	t.Setenv("SESSION_ABSOLUTE_TTL", "")
	t.Setenv("SESSION_RENEW_AFTER", "")
	t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Identity.SessionIdleTTL != 8*time.Hour {
		t.Errorf("SessionIdleTTL = %s, want 8h", cfg.Identity.SessionIdleTTL)
	}
	if cfg.Identity.SessionAbsoluteTTL != 8*time.Hour {
		t.Errorf("SessionAbsoluteTTL = %s, want 8h", cfg.Identity.SessionAbsoluteTTL)
	}
	if cfg.Identity.SessionRenewAfter != 0 {
		t.Errorf("SessionRenewAfter = %s, want disabled (0)", cfg.Identity.SessionRenewAfter)
	}
}

func TestLoadSessionPolicyUsesExplicitDurations(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("SESSION_TTL", "8h")
	t.Setenv("SESSION_IDLE_TTL", "2h")
	t.Setenv("SESSION_ABSOLUTE_TTL", "6h")
	t.Setenv("SESSION_RENEW_AFTER", "1h")
	t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Identity.SessionIdleTTL != 2*time.Hour {
		t.Errorf("SessionIdleTTL = %s, want 2h", cfg.Identity.SessionIdleTTL)
	}
	if cfg.Identity.SessionAbsoluteTTL != 6*time.Hour {
		t.Errorf("SessionAbsoluteTTL = %s, want 6h", cfg.Identity.SessionAbsoluteTTL)
	}
	if cfg.Identity.SessionRenewAfter != time.Hour {
		t.Errorf("SessionRenewAfter = %s, want 1h", cfg.Identity.SessionRenewAfter)
	}
}

func TestLoadReadsDurableSessionStoreRequirement(t *testing.T) {
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("GATEWAY_REDIS_URL", "redis://127.0.0.1:6379/0")
	t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if !cfg.Identity.RequireDurableSessionStore {
		t.Fatal("RequireDurableSessionStore = false, want true")
	}
}

func configureSessionLoadForTest(t *testing.T) {
	t.Helper()
	t.Setenv("ENVIRONMENT", "development")
	t.Setenv("SESSION_TTL", "8h")
	t.Setenv("SESSION_IDLE_TTL", "")
	t.Setenv("SESSION_ABSOLUTE_TTL", "")
	t.Setenv("SESSION_RENEW_AFTER", "")
	t.Setenv("GATEWAY_REDIS_URL", "redis://127.0.0.1:6379/0")
	t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", "")
}

func TestLoadRejectsInvalidExplicitSessionConfiguration(t *testing.T) {
	tests := []struct {
		name  string
		key   string
		value string
	}{
		{name: "idle duration", key: "SESSION_IDLE_TTL", value: "not-a-duration"},
		{name: "absolute duration", key: "SESSION_ABSOLUTE_TTL", value: "not-a-duration"},
		{name: "renewal duration", key: "SESSION_RENEW_AFTER", value: "not-a-duration"},
		{name: "durable session store boolean", key: "GATEWAY_REQUIRE_DURABLE_SESSION_STORE", value: "sometimes"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configureSessionLoadForTest(t)
			t.Setenv(tt.key, tt.value)

			if _, err := Load(); err == nil || !strings.Contains(err.Error(), tt.key) {
				t.Fatalf("Load() error = %v, want %s", err, tt.key)
			}
		})
	}
}

func TestLoadParsesDurableSessionStoreBooleans(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "empty defaults false", value: "", want: false},
		{name: "whitespace defaults false", value: "   ", want: false},
		{name: "true", value: "true", want: true},
		{name: "uppercase true", value: "TRUE", want: true},
		{name: "one", value: "1", want: true},
		{name: "yes", value: "yes", want: true},
		{name: "false", value: "false", want: false},
		{name: "uppercase false", value: "FALSE", want: false},
		{name: "zero", value: "0", want: false},
		{name: "no", value: "no", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configureSessionLoadForTest(t)
			t.Setenv("GATEWAY_REQUIRE_DURABLE_SESSION_STORE", tt.value)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}
			if cfg.Identity.RequireDurableSessionStore != tt.want {
				t.Fatalf("RequireDurableSessionStore = %t, want %t", cfg.Identity.RequireDurableSessionStore, tt.want)
			}
		})
	}
}

func TestValidateSessionPolicy(t *testing.T) {
	tests := []struct {
		name  string
		apply func(*Config)
		want  string
	}{
		{name: "idle TTL must be positive", apply: func(cfg *Config) { cfg.Identity.SessionIdleTTL = 0 }, want: "SESSION_IDLE_TTL"},
		{name: "absolute TTL must be positive", apply: func(cfg *Config) { cfg.Identity.SessionAbsoluteTTL = 0 }, want: "SESSION_ABSOLUTE_TTL"},
		{name: "idle TTL cannot exceed absolute TTL", apply: func(cfg *Config) { cfg.Identity.SessionIdleTTL = 2 * time.Hour }, want: "SESSION_IDLE_TTL must not exceed SESSION_ABSOLUTE_TTL"},
		{name: "renewal threshold cannot be negative", apply: func(cfg *Config) { cfg.Identity.SessionRenewAfter = -time.Minute }, want: "SESSION_RENEW_AFTER"},
		{name: "renewal threshold cannot equal idle TTL", apply: func(cfg *Config) { cfg.Identity.SessionRenewAfter = time.Hour }, want: "SESSION_RENEW_AFTER must be less than SESSION_IDLE_TTL"},
		{name: "renewal threshold cannot exceed idle TTL", apply: func(cfg *Config) { cfg.Identity.SessionRenewAfter = 2 * time.Hour }, want: "SESSION_RENEW_AFTER must be less than SESSION_IDLE_TTL"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := sessionConfigForTest()
			tt.apply(&cfg)
			if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Validate() error = %v, want %s", err, tt.want)
			}
		})
	}
}

func TestValidateRequiresRedisForDurableSessions(t *testing.T) {
	cfg := sessionConfigForTest()
	cfg.Identity.RequireDurableSessionStore = true
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "GATEWAY_REDIS_URL is required when GATEWAY_REQUIRE_DURABLE_SESSION_STORE is true") {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestProductionRejectsWildcardCredentialedCORS(t *testing.T) {
	cfg := productionConfigForTest()
	cfg.CORS.AllowedOrigins = []string{"https://*.axi.example.com"}
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "wildcard") {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestProductionRequiresAPIResourceAudienceAndScope(t *testing.T) {
	cfg := productionConfigForTest()
	cfg.Identity.APIAudience = ""
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "OIDC_ISSUER_URL") {
		t.Fatalf("missing audience error = %v", err)
	}
	cfg = productionConfigForTest()
	cfg.Identity.RequiredAccessTokenScopes = nil
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "OIDC_REQUIRED_ACCESS_TOKEN_SCOPES") {
		t.Fatalf("missing API scope error = %v", err)
	}
}

func TestProductionRequiresRedisURL(t *testing.T) {
	cfg := productionConfigForTest()
	cfg.Identity.RedisURL = ""
	if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), "GATEWAY_REDIS_URL") {
		t.Fatalf("missing Redis URL error = %v", err)
	}
}

func TestProductionRequiresDedicatedSpecialistCredentials(t *testing.T) {
	tests := []struct {
		name  string
		apply func(*Config)
		want  string
	}{
		{name: "file", apply: func(cfg *Config) { cfg.Services.FileInternalToken = "" }, want: "GATEWAY_FILE_INTERNAL_TOKEN"},
		{name: "workflow", apply: func(cfg *Config) { cfg.Services.WorkflowInternalToken = "" }, want: "GATEWAY_WORKFLOW_INTERNAL_TOKEN"},
		{name: "notification", apply: func(cfg *Config) { cfg.Services.NotificationInternalToken = "" }, want: "GATEWAY_NOTIFICATION_INTERNAL_TOKEN"},
		{name: "outbox", apply: func(cfg *Config) { cfg.Services.PlatformOutboxToken = "" }, want: "GATEWAY_PLATFORM_OUTBOX_TOKEN"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := productionConfigForTest()
			tt.apply(&cfg)
			if err := cfg.Validate(); err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("Validate() error = %v, want %s", err, tt.want)
			}
		})
	}
}
