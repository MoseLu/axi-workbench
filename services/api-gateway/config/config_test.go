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
