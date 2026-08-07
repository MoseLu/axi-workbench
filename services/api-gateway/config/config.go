package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config describes the only public Axi business API entry point. Backend
// service addresses are cluster-internal values; browser clients use relative
// /api requests and never receive their credentials.
type Config struct {
	Environment   string
	Server        ServerConfig
	Services      ServicesConfig
	Identity      IdentityConfig
	RateLimit     RateLimitConfig
	Observability ObservabilityConfig
	Log           LogConfig
	CORS          CORSConfig
}

type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type ServicesConfig struct {
	IdentityAdapterURL        string
	PlatformCoreURL           string
	LegacyCoreServiceURL      string
	FileServiceURL            string
	WorkflowURL               string
	NotificationURL           string
	IdentityInternalToken     string
	PlatformInternalToken     string
	FileInternalToken         string
	WorkflowInternalToken     string
	NotificationInternalToken string
}

type IdentityConfig struct {
	IssuerURL                 string
	ClientID                  string
	ClientSecret              string
	APIAudience               string
	RequiredAccessTokenScopes []string
	CallbackURL               string
	AllowedReturnURLs         []string
	SessionCookieName         string
	SessionCookieDomain       string
	SessionCookieSecure       bool
	SessionTTL                time.Duration
	RedisURL                  string
	DevelopmentHeaderAuth     bool
}

type RateLimitConfig struct {
	RequestsPerMinute int
	RedisURL          string
}

type ObservabilityConfig struct {
	OTLPTracesEndpoint string
}

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

type LogConfig struct {
	Level string
}

func Load() (*Config, error) {
	environment := getEnv("ENVIRONMENT", "development")
	redisURL := os.Getenv("GATEWAY_REDIS_URL")
	cfg := &Config{
		Environment: environment,
		Server: ServerConfig{
			Port:         getEnv("GATEWAY_PORT", getEnv("PORT", "8080")),
			ReadTimeout:  getDurationEnv("READ_TIMEOUT", 30*time.Second),
			WriteTimeout: getDurationEnv("WRITE_TIMEOUT", 30*time.Second),
		},
		Services: ServicesConfig{
			IdentityAdapterURL:        getEnv("IDENTITY_ADAPTER_URL", "http://localhost:8081"),
			PlatformCoreURL:           getEnv("PLATFORM_CORE_URL", "http://localhost:8082"),
			LegacyCoreServiceURL:      os.Getenv("LEGACY_CORE_SERVICE_URL"),
			FileServiceURL:            getEnv("FILE_SERVICE_URL", "http://localhost:3003"),
			WorkflowURL:               getEnv("WORKFLOW_SERVICE_URL", "http://localhost:3004"),
			NotificationURL:           getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8084"),
			IdentityInternalToken:     getEnv("GATEWAY_IDENTITY_INTERNAL_TOKEN", getEnv("IDENTITY_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
			PlatformInternalToken:     getEnv("GATEWAY_PLATFORM_INTERNAL_TOKEN", getEnv("PLATFORM_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
			FileInternalToken:         getEnv("GATEWAY_FILE_INTERNAL_TOKEN", getEnv("FILE_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
			WorkflowInternalToken:     getEnv("GATEWAY_WORKFLOW_INTERNAL_TOKEN", getEnv("WORKFLOW_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
			NotificationInternalToken: getEnv("GATEWAY_NOTIFICATION_INTERNAL_TOKEN", getEnv("NOTIFICATION_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token")),
		},
		Identity: IdentityConfig{
			IssuerURL:                 strings.TrimSuffix(os.Getenv("OIDC_ISSUER_URL"), "/"),
			ClientID:                  os.Getenv("OIDC_CLIENT_ID"),
			ClientSecret:              os.Getenv("OIDC_CLIENT_SECRET"),
			APIAudience:               getEnv("OIDC_API_AUDIENCE", os.Getenv("OIDC_CLIENT_ID")),
			RequiredAccessTokenScopes: getEnvSlice("OIDC_REQUIRED_ACCESS_TOKEN_SCOPES", nil),
			CallbackURL:               getEnv("OIDC_CALLBACK_URL", "http://127.0.0.1:8088/api/v1/auth/oidc/callback"),
			AllowedReturnURLs:         getEnvSlice("OIDC_ALLOWED_RETURN_URLS", []string{"http://127.0.0.1:5173/auth/callback", "http://127.0.0.1:5174/auth/callback"}),
			SessionCookieName:         getEnv("SESSION_COOKIE_NAME", "axi_session"),
			SessionCookieDomain:       os.Getenv("SESSION_COOKIE_DOMAIN"),
			SessionCookieSecure:       getBoolEnv("SESSION_COOKIE_SECURE", environment == "production"),
			SessionTTL:                getDurationEnv("SESSION_TTL", 8*time.Hour),
			RedisURL:                  redisURL,
			DevelopmentHeaderAuth:     getBoolEnv("GATEWAY_ALLOW_DEVELOPMENT_HEADER_AUTH", false),
		},
		RateLimit: RateLimitConfig{
			RequestsPerMinute: getIntEnv("GATEWAY_RATE_LIMIT_PER_MINUTE", 120),
			RedisURL:          redisURL,
		},
		Observability: ObservabilityConfig{
			OTLPTracesEndpoint: strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
		},
		Log: LogConfig{Level: getEnv("API_GATEWAY_LOG_LEVEL", getEnv("LOG_LEVEL", "info"))},
		CORS: CORSConfig{
			AllowedOrigins: getEnvSlice("CORS_ALLOWED_ORIGINS", []string{"http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:5173", "http://localhost:5174"}),
			AllowedMethods: getEnvSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}),
			AllowedHeaders: getEnvSlice("CORS_ALLOWED_HEADERS", []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Request-ID", "X-Axi-QR-Poll-Token"}),
		},
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	if c.RateLimit.RequestsPerMinute <= 0 || c.Identity.SessionTTL <= 0 {
		return fmt.Errorf("gateway rate limit and session TTL must be positive")
	}
	if c.Environment == "production" {
		if c.Identity.IssuerURL == "" || c.Identity.ClientID == "" || c.Identity.APIAudience == "" {
			return fmt.Errorf("OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_API_AUDIENCE are required in production")
		}
		if len(c.Identity.RequiredAccessTokenScopes) == 0 {
			return fmt.Errorf("OIDC_REQUIRED_ACCESS_TOKEN_SCOPES is required in production")
		}
		if c.Identity.RedisURL == "" {
			return fmt.Errorf("GATEWAY_REDIS_URL is required in production")
		}
		if c.Identity.DevelopmentHeaderAuth {
			return fmt.Errorf("GATEWAY_ALLOW_DEVELOPMENT_HEADER_AUTH is forbidden in production")
		}
		if c.Services.IdentityInternalToken == "" || c.Services.IdentityInternalToken == "axi-development-internal-token" {
			return fmt.Errorf("GATEWAY_IDENTITY_INTERNAL_TOKEN must be injected in production")
		}
		if c.Services.PlatformInternalToken == "" || c.Services.PlatformInternalToken == "axi-development-internal-token" {
			return fmt.Errorf("GATEWAY_PLATFORM_INTERNAL_TOKEN must be injected in production")
		}
		if c.Services.FileInternalToken == "" || c.Services.FileInternalToken == "axi-development-internal-token" {
			return fmt.Errorf("GATEWAY_FILE_INTERNAL_TOKEN must be injected in production")
		}
		if c.Services.WorkflowInternalToken == "" || c.Services.WorkflowInternalToken == "axi-development-internal-token" {
			return fmt.Errorf("GATEWAY_WORKFLOW_INTERNAL_TOKEN must be injected in production")
		}
		if c.Services.NotificationInternalToken == "" || c.Services.NotificationInternalToken == "axi-development-internal-token" {
			return fmt.Errorf("GATEWAY_NOTIFICATION_INTERNAL_TOKEN must be injected in production")
		}
		if err := validateProductionOrigins(c.CORS.AllowedOrigins); err != nil {
			return err
		}
	}
	return nil
}

func validateProductionOrigins(origins []string) error {
	if len(origins) == 0 {
		return fmt.Errorf("CORS_ALLOWED_ORIGINS must contain exact HTTPS origins in production")
	}
	for _, origin := range origins {
		if strings.Contains(origin, "*") {
			return fmt.Errorf("CORS wildcard origins are forbidden in production")
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
			return fmt.Errorf("CORS origin %q must be an exact HTTPS origin in production", origin)
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getIntEnv(key string, fallback int) int {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if integer, err := strconv.Atoi(value); err == nil {
			return integer
		}
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return fallback
}

func getBoolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value == "1" || strings.EqualFold(value, "true") || strings.EqualFold(value, "yes")
}

func getEnvSlice(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
