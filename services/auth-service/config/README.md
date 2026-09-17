# Auth Service Environment Variables

## Required Variables (No Defaults)

These secrets must be set via environment variables or `config.local.go`:

| Variable | Purpose | Generation Command |
|----------|---------|-------------------|
| `JWT_ACCESS_SECRET` | JWT access token signing key | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | JWT refresh token signing key | `openssl rand -base64 32` |
| `OAUTH_QR_SECRET` | OAuth QR code signing secret | `openssl rand -base64 32` |
| `DB_PASSWORD` | PostgreSQL database password | `openssl rand -base64 32` |

## Optional Variables (Have Defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_PORT` | `8080` | HTTP server port |
| `SERVER_HOST` | `0.0.0.0` | HTTP server host |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_NAME` | `auth_db` | PostgreSQL database name |
| `JWT_ACCESS_EXPIRY` | `900` (seconds) | Access token expiry |
| `JWT_REFRESH_EXPIRY` | `604800` (seconds) | Refresh token expiry |
| `JWT_REMEMBER_ME_EXPIRY` | `2592000` (seconds) | Remember me token expiry |

## Local Development Setup

### Option 1: Environment Variables (Recommended for containers/CI)

```bash
export JWT_ACCESS_SECRET="$(openssl rand -base64 32)"
export JWT_REFRESH_SECRET="$(openssl rand -base64 32)"
export OAUTH_QR_SECRET="$(openssl rand -base64 32)"
export DB_PASSWORD="$(openssl rand -base64 32)"
```

### Option 2: config.local.go

For local Go development, create `config.local.go` in `services/auth-service/config/`:

```go
package config

import "os"

func init() {
    os.Setenv("JWT_ACCESS_SECRET", "your-generated-secret")
    os.Setenv("JWT_REFRESH_SECRET", "your-generated-secret")
    os.Setenv("OAUTH_QR_SECRET", "your-generated-secret")
    os.Setenv("DB_PASSWORD", "your-generated-secret")
}
```

**Important**: `config.local.go` is gitignored and should never be committed.

## Production Deployment

In production, set these as secrets in your orchestration platform:
- Kubernetes: Use Sealed Secrets or External Secrets Operator
- Docker: Use `--env-file` with a secrets file, not baked into images
- CI/CD: Use provider-specific secrets management (AWS Secrets Manager, GCP Secret Manager, etc.)
