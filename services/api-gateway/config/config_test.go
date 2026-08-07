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
			RedisURL:                  "redis://gateway",
		},
		RateLimit: RateLimitConfig{RequestsPerMinute: 120},
		Services: ServicesConfig{
			IdentityInternalToken: "identity-token",
			PlatformInternalToken: "platform-token",
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
