// config.local.go - Local development secrets
// This file is NOT committed to version control (.gitignore includes .env*.local)
// Copy this to config.local.go and set your actual secrets for local development
//
// Alternatively, set these environment variables directly:
// - JWT_ACCESS_SECRET: JWT access token signing key
// - JWT_REFRESH_SECRET: JWT refresh token signing key
// - OAUTH_QR_SECRET: OAuth QR code signing secret
// - DB_PASSWORD: Database password
//
// Generate secure secrets with: openssl rand -base64 32
package config

import "os"

func init() {
	os.Setenv("JWT_ACCESS_SECRET", "PzNuVzEwwW/MfLFOH7A3bsSReaIruWxlh7CIYunBWz4=")
	os.Setenv("JWT_REFRESH_SECRET", "jJuLpK5+in0EkEMS6uIOI8JRRMNGBoUMnSuI1Dl80wo=")
	os.Setenv("OAUTH_QR_SECRET", "5zBASYh6QACpiJ1xIORdcvwZ3RabVUJynf6/v3QJrVk=")
	os.Setenv("DB_PASSWORD", "sWT1LtJASKo6wL+NEQdNHEC6KD0gMIGFOv/b5HJpSeY=")
}
