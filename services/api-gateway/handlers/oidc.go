package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

func OIDCStart(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		returnTo := c.Query("return_to")
		if returnTo == "" {
			returnTo = "/"
		}
		location, err := service.Begin(c.Request.Context(), returnTo)
		if err != nil {
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Axi OIDC issuer is not configured"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid OIDC login request"})
			return
		}
		http.Redirect(c.Writer, c.Request, location, http.StatusFound)
	}
}

func OIDCCallback(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		state := c.Query("state")
		code := c.Query("code")
		if state == "" || code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "OIDC callback requires state and code"})
			return
		}
		sessionID, _, returnTo, err := service.Complete(c.Request.Context(), state, code)
		if err != nil {
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Axi OIDC issuer is not configured"})
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "OIDC authorization could not be completed"})
			return
		}
		service.SetCookie(c.Writer, sessionID)
		http.Redirect(c.Writer, c.Request, returnTo, http.StatusFound)
	}
}

func Session(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// A protected route may already have restored and rotated this browser
		// session in RequireIdentity. Reusing that principal prevents a second
		// RestoreSession call from looking up the predecessor cookie again.
		if principal, ok := middleware.PrincipalFromContext(c); ok {
			c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": principal})
			return
		}

		principal, sessionID, err := service.RestoreSession(c.Request.Context(), c.Request)
		if err == nil {
			service.SetCookie(c.Writer, sessionID)
			c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": principal})
			return
		}
		if errors.Is(err, identity.ErrSessionStoreUnavailable) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
			return
		}
		if !errors.Is(err, identity.ErrUnauthorized) {
			c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
			return
		}

		// Browser-session absence or invalidity may still be satisfied by an
		// explicit bearer token or development header. Those credential paths
		// never write a browser cookie.
		principal, err = service.AuthenticateHeaderCredentials(c.Request.Context(), c.Request.Header)
		if err != nil {
			if errors.Is(err, identity.ErrSessionStoreUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
			return
		}
		c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": principal})
	}
}

func Logout(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := service.Logout(c.Request.Context(), c.Request); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
			return
		}
		service.ClearCookie(c.Writer)
		c.Status(http.StatusNoContent)
	}
}

// EmailLoginConfirm verifies a one-time email token through the identity-adapter
// and, on success, issues a browser session for the verified email address.
// The identity-adapter's /email-verifications/confirm endpoint already
// enforces single-use + TTL, so the gateway only needs to add session
// issuance on top.
func EmailLoginConfirm(service *identity.Service, identityAdapterURL string) gin.HandlerFunc {
	client := &http.Client{Timeout: 10 * time.Second}
	return func(c *gin.Context) {
		var req struct {
			ChallengeID string `json:"challengeId" binding:"required"`
			Token       string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ChallengeID) == "" || !emailCodePattern.MatchString(strings.TrimSpace(req.Token)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "challengeId and a six-digit verification token are required"})
			return
		}
		verifiedEmail, verifyErr := verifyEmailToken(c.Request.Context(), client, identityAdapterURL, strings.TrimSpace(req.ChallengeID), strings.TrimSpace(req.Token))
		if verifyErr != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verification failed"})
			return
		}
		sessionID, err := service.IssueEmailSession(c.Request.Context(), verifiedEmail)
		if err != nil {
			if errors.Is(err, identity.ErrUnauthorized) {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "email is not an approved owner identity"})
				return
			}
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "email login is not configured"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue session"})
			return
		}
		service.SetCookie(c.Writer, sessionID)
		principal, err := service.EmailLoginPrincipal(verifiedEmail)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "email is not an approved owner identity"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"authenticated": true,
			"user":          principal,
		})
	}
}

// PasswordLogin verifies the configured owner password and issues the same
// durable HttpOnly browser session used by the other login factors. The
// configured bcrypt hash stays inside the identity service; this handler never
// forwards or returns a password token.
func PasswordLogin(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email    string `json:"email" binding:"required,email"`
			Password string `json:"password" binding:"required,min=8,max=72"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
			return
		}
		principal, err := service.AuthenticatePassword(c.Request.Context(), req.Email, req.Password)
		if err != nil {
			if errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "password login is not configured"})
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		sessionID, err := service.IssuePrincipalSession(c.Request.Context(), principal)
		if err != nil {
			if errors.Is(err, identity.ErrSessionStoreUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue session"})
			return
		}
		service.SetCookie(c.Writer, sessionID)
		c.JSON(http.StatusOK, gin.H{
			"authenticated": true,
			"user":          principal,
		})
	}
}

// AuthMethods exposes capability flags without revealing owner identity or
// credential material. It lets the Web client keep an unavailable password
// tab visibly honest while still using the same right-column layout.
func AuthMethods(service *identity.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"emailLogin":    service.EmailLoginConfigured(),
			"passwordLogin": service.PasswordLoginConfigured(),
			"qrLogin":       true,
		})
	}
}

var emailCodePattern = regexp.MustCompile(`^\d{6}$`)

func verifyEmailToken(ctx context.Context, client *http.Client, baseURL, challengeID, token string) (string, error) {
	body, _ := json.Marshal(map[string]string{"challengeId": challengeID, "purpose": "login", "token": token})
	url := strings.TrimRight(baseURL, "/") + "/api/v1/auth/email-verifications/confirm"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", errors.New(strings.TrimSpace(string(raw)))
	}
	var out struct {
		Email    string `json:"email"`
		Purpose  string `json:"purpose"`
		Verified bool   `json:"verified"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	if !out.Verified || out.Email == "" || out.Purpose != "login" {
		return "", errors.New("identity-adapter did not confirm email")
	}
	return out.Email, nil
}
