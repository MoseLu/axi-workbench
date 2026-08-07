package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// Config contains the identity boundary configuration. Secrets are injected by
// the runtime and are deliberately not represented in application files.
type Config struct {
	Environment           string
	Port                  string
	DatabaseURL           string
	RedisURL              string
	InternalServiceToken  string
	ZitadelWebhookSecret  string
	ZitadelCustomLoginURL string
	PublicBaseURL         string
	AllowedRedirectURIs   []string
	QRTransactionTTL      time.Duration
	EmailVerificationTTL  time.Duration
	EmailDelivery         string
	SMTPHost              string
	SMTPPort              string
	SMTPUsername          string
	SMTPPassword          string
	SMTPFrom              string
	SMTPAllowInsecure     bool
	OTLPTracesEndpoint    string
}

func Load() (Config, error) {
	return load(true)
}

// LoadForMigration validates only the identity persistence prerequisite. A
// one-shot schema migration must not depend on SMTP, Redis, or webhook runtime
// credentials that are not part of the migration itself.
func LoadForMigration() (Config, error) {
	return load(false)
}

func load(validateRuntime bool) (Config, error) {
	cfg := Config{
		Environment:          getEnv("ENVIRONMENT", "development"),
		Port:                 getEnv("IDENTITY_ADAPTER_PORT", getEnv("PORT", "8081")),
		DatabaseURL:          os.Getenv("IDENTITY_DATABASE_URL"),
		RedisURL:             os.Getenv("IDENTITY_REDIS_URL"),
		InternalServiceToken: getEnv("IDENTITY_INTERNAL_SERVICE_TOKEN", "axi-development-internal-token"),
		ZitadelWebhookSecret: getEnv("ZITADEL_WEBHOOK_SECRET", "axi-development-zitadel-webhook"),
		ZitadelCustomLoginURL: getEnv(
			"ZITADEL_CUSTOM_LOGIN_URL",
			"http://127.0.0.1:8088/identity/login",
		),
		PublicBaseURL: getEnv("IDENTITY_PUBLIC_BASE_URL", "http://127.0.0.1:8088"),
		AllowedRedirectURIs: getCSV(
			"OIDC_ALLOWED_RETURN_URLS",
			getCSV("OIDC_ALLOWED_REDIRECT_URIS", []string{
				"http://127.0.0.1:5173/auth/callback",
				"http://127.0.0.1:5174/auth/callback",
				"http://localhost:5173/auth/callback",
				"http://localhost:5174/auth/callback",
			}),
		),
		QRTransactionTTL:     getDuration("IDENTITY_QR_TRANSACTION_TTL", 2*time.Minute),
		EmailVerificationTTL: getDuration("IDENTITY_EMAIL_VERIFICATION_TTL", 15*time.Minute),
		EmailDelivery:        strings.ToLower(getEnv("IDENTITY_EMAIL_DELIVERY", "log")),
		SMTPHost:             os.Getenv("SMTP_HOST"),
		SMTPPort:             getEnv("SMTP_PORT", "587"),
		SMTPUsername:         os.Getenv("SMTP_USERNAME"),
		SMTPPassword:         os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:             os.Getenv("SMTP_FROM"),
		SMTPAllowInsecure:    getBool("SMTP_ALLOW_INSECURE", false),
		OTLPTracesEndpoint:   strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
	}

	if err := cfg.validate(validateRuntime); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error { return c.validate(true) }

func (c Config) validate(validateRuntime bool) error {
	if c.QRTransactionTTL <= 0 || c.EmailVerificationTTL <= 0 {
		return fmt.Errorf("identity TTL values must be positive")
	}
	if c.Environment == "production" {
		if c.DatabaseURL == "" {
			return fmt.Errorf("IDENTITY_DATABASE_URL is required in production")
		}
		if !validateRuntime {
			return nil
		}
		if c.RedisURL == "" {
			return fmt.Errorf("IDENTITY_REDIS_URL is required in production")
		}
		if c.InternalServiceToken == "" || c.InternalServiceToken == "axi-development-internal-token" {
			return fmt.Errorf("IDENTITY_INTERNAL_SERVICE_TOKEN must be injected in production")
		}
		if c.ZitadelWebhookSecret == "" || c.ZitadelWebhookSecret == "axi-development-zitadel-webhook" {
			return fmt.Errorf("ZITADEL_WEBHOOK_SECRET must be injected in production")
		}
		if c.EmailDelivery != "smtp" {
			return fmt.Errorf("IDENTITY_EMAIL_DELIVERY=smtp is required in production")
		}
		if c.SMTPAllowInsecure {
			return fmt.Errorf("SMTP_ALLOW_INSECURE is forbidden in production")
		}
	}
	if !validateRuntime {
		return nil
	}
	if c.EmailDelivery != "log" && c.EmailDelivery != "smtp" {
		return fmt.Errorf("unsupported IDENTITY_EMAIL_DELIVERY %q", c.EmailDelivery)
	}
	if c.EmailDelivery == "smtp" && (c.SMTPHost == "" || c.SMTPUsername == "" || c.SMTPPassword == "" || c.SMTPFrom == "") {
		return fmt.Errorf("SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM are required for SMTP delivery")
	}
	return nil
}

func (c Config) RedirectAllowed(value string) bool {
	for _, candidate := range c.AllowedRedirectURIs {
		if value == candidate {
			return true
		}
	}
	return false
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getCSV(key string, fallback []string) []string {
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

func getDuration(key string, fallback time.Duration) time.Duration {
	if raw := strings.TrimSpace(os.Getenv(key)); raw != "" {
		if value, err := time.ParseDuration(raw); err == nil {
			return value
		}
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value == "1" || strings.EqualFold(value, "true") || strings.EqualFold(value, "yes")
}
