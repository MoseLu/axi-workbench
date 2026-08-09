package httpapi

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/config"
	"github.com/axi-workbench/identity-adapter/internal/email"
	"github.com/axi-workbench/identity-adapter/internal/model"
	"github.com/axi-workbench/identity-adapter/internal/observability"
	"github.com/axi-workbench/identity-adapter/internal/store"
	"github.com/axi-workbench/identity-adapter/internal/trust"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	pkceChallengePattern = regexp.MustCompile(`^[A-Za-z0-9._~-]{43,128}$`)
	purposePattern       = regexp.MustCompile(`^[a-z][a-z-]{1,63}$`)
	numericCodePattern   = regexp.MustCompile(`^\d{6}$`)
)

type API struct {
	config config.Config
	store  store.Store
	sender email.Sender
	now    func() time.Time
	logger *slog.Logger
}

func New(cfg config.Config, persistence store.Store, sender email.Sender, now func() time.Time, logger *slog.Logger) *API {
	if now == nil {
		now = time.Now
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &API{config: cfg, store: persistence, sender: sender, now: now, logger: logger}
}

func (a *API) Router() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery(), a.requestID(), observability.Gin("axi-identity-adapter"))
	router.GET("/health", a.health)
	router.GET("/ready", a.ready)

	auth := router.Group("/api/v1/auth")
	auth.POST("/qr/transactions", a.startQRTransaction)
	auth.GET("/qr/transactions/:id", a.pollQRTransaction)
	auth.POST("/qr/transactions/:id/resume", a.resumeQRTransaction)
	auth.POST("/qr/transactions/:id/approve", a.requireInternal(), a.approveQRTransaction)
	auth.POST("/email-verifications", a.requestEmailVerification)
	auth.POST("/email-verifications/confirm", a.confirmEmailVerification)
	auth.GET("/eps/links/:provider", a.requireInternal(), a.getEPSIdentityLink)
	auth.PUT("/eps/links/:provider", a.requireInternal(), a.putEPSIdentityLink)

	router.POST("/api/v1/internal/zitadel/qr/transactions/:id/complete", a.requireZitadelWebhook(), a.completeQRTransaction)
	return router
}

func (a *API) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) ready(c *gin.Context) {
	if err := a.store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "identity persistence is unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

func (a *API) requestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Header("X-Request-ID", requestID)
		c.Set("requestID", requestID)
		c.Next()
	}
}

func (a *API) requireInternal() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !trust.InternalRequest(c.Request, a.config.InternalServiceToken) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "trusted gateway request required"})
			return
		}
		if strings.TrimSpace(c.GetHeader(trust.SubjectHeader)) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "verified subject required"})
			return
		}
		c.Next()
	}
}

func (a *API) requireZitadelWebhook() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !constantTimeEqual(c.GetHeader("X-Axi-Zitadel-Webhook"), a.config.ZitadelWebhookSecret) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "ZITADEL custom-login request required"})
			return
		}
		c.Next()
	}
}

type startQRRequest struct {
	ClientID            string `json:"clientId" binding:"required"`
	RedirectURI         string `json:"redirectUri" binding:"required"`
	CodeChallenge       string `json:"codeChallenge" binding:"required"`
	CodeChallengeMethod string `json:"codeChallengeMethod" binding:"required"`
	State               string `json:"state"`
}

func (a *API) startQRTransaction(c *gin.Context) {
	var request startQRRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "clientId, redirectUri and PKCE S256 challenge are required"})
		return
	}
	if !a.config.RedirectAllowed(request.RedirectURI) || !validPKCE(request.CodeChallenge, request.CodeChallengeMethod) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unapproved redirect URI or invalid PKCE S256 challenge"})
		return
	}
	ticket, err := opaqueToken()
	if err != nil {
		a.internalError(c, "create QR ticket", err)
		return
	}
	pollToken, err := opaqueToken()
	if err != nil {
		a.internalError(c, "create QR poll token", err)
		return
	}
	now := a.now().UTC()
	transaction := model.QRTransaction{
		ID:                  uuid.NewString(),
		TicketHash:          hashSecret(ticket),
		PollTokenHash:       hashSecret(pollToken),
		ClientID:            strings.TrimSpace(request.ClientID),
		RedirectURI:         request.RedirectURI,
		CodeChallenge:       request.CodeChallenge,
		CodeChallengeMethod: "S256",
		State:               request.State,
		Status:              model.QRPending,
		ExpiresAt:           now.Add(a.config.QRTransactionTTL),
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if err := a.store.CreateQRTransaction(c.Request.Context(), transaction); err != nil {
		a.internalError(c, "persist QR transaction", err)
		return
	}
	payload, err := a.qrPayload(transaction.ID, ticket)
	if err != nil {
		a.internalError(c, "create QR payload", err)
		return
	}
	a.audit(c, "qr.transaction.created", "transactionID", transaction.ID, "clientID", transaction.ClientID)
	c.JSON(http.StatusCreated, gin.H{
		"transactionId":  transaction.ID,
		"qrPayload":      payload,
		"pollToken":      pollToken,
		"status":         transaction.Status,
		"expiresAt":      transaction.ExpiresAt,
		"pollIntervalMs": 1500,
	})
}

func (a *API) pollQRTransaction(c *gin.Context) {
	transaction, ok := a.authorizePoll(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"transactionId": transaction.ID,
		"status":        transaction.EffectiveStatus(a.now()),
		"expiresAt":     transaction.ExpiresAt,
	})
}

func (a *API) resumeQRTransaction(c *gin.Context) {
	transaction, ok := a.authorizePoll(c)
	if !ok {
		return
	}
	if transaction.EffectiveStatus(a.now()) == model.QRExpired {
		c.JSON(http.StatusGone, gin.H{"error": "QR transaction has expired"})
		return
	}
	resumeToken, err := opaqueToken()
	if err != nil {
		a.internalError(c, "create QR resume ticket", err)
		return
	}
	transaction, err = a.store.BeginQRResume(c.Request.Context(), transaction.ID, transaction.PollTokenHash, hashSecret(resumeToken))
	if err != nil {
		a.domainError(c, err)
		return
	}
	continueURL, err := a.zitadelContinueURL(transaction.ID, resumeToken)
	if err != nil {
		a.internalError(c, "create ZITADEL continuation", err)
		return
	}
	a.audit(c, "qr.transaction.resuming", "transactionID", transaction.ID)
	c.JSON(http.StatusOK, gin.H{
		"transactionId": transaction.ID,
		"status":        transaction.Status,
		"continueUrl":   continueURL,
	})
}

func (a *API) authorizePoll(c *gin.Context) (model.QRTransaction, bool) {
	transaction, err := a.store.GetQRTransaction(c.Request.Context(), c.Param("id"))
	if err != nil {
		a.domainError(c, err)
		return model.QRTransaction{}, false
	}
	if !constantTimeEqual(hashSecret(c.GetHeader("X-Axi-QR-Poll-Token")), transaction.PollTokenHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "valid browser poll credential required"})
		return model.QRTransaction{}, false
	}
	return transaction, true
}

type approveQRRequest struct {
	Ticket string `json:"ticket" binding:"required"`
}

func (a *API) approveQRTransaction(c *gin.Context) {
	var request approveQRRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QR ticket is required"})
		return
	}
	transaction, err := a.store.ApproveQRTransaction(
		c.Request.Context(), c.Param("id"), hashSecret(request.Ticket), strings.TrimSpace(c.GetHeader(trust.SubjectHeader)),
	)
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "qr.transaction.approved", "transactionID", transaction.ID, "subject", transaction.Subject)
	c.JSON(http.StatusAccepted, gin.H{"transactionId": transaction.ID, "status": transaction.Status})
}

type completeQRRequest struct {
	ResumeToken string `json:"resumeToken" binding:"required"`
}

func (a *API) completeQRTransaction(c *gin.Context) {
	var request completeQRRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "QR resume token is required"})
		return
	}
	transaction, err := a.store.ConsumeQRResume(c.Request.Context(), c.Param("id"), hashSecret(request.ResumeToken))
	if err != nil {
		a.domainError(c, err)
		return
	}
	// ZITADEL's custom-login implementation consumes this request context and
	// performs the actual OIDC authorization-code issuance. This adapter never
	// issues a JWT or authorization code itself.
	a.audit(c, "qr.transaction.completed", "transactionID", transaction.ID, "subject", transaction.Subject)
	c.JSON(http.StatusOK, gin.H{
		"subject":             transaction.Subject,
		"clientId":            transaction.ClientID,
		"redirectUri":         transaction.RedirectURI,
		"codeChallenge":       transaction.CodeChallenge,
		"codeChallengeMethod": transaction.CodeChallengeMethod,
		"state":               transaction.State,
	})
}

type requestEmailVerification struct {
	Email   string `json:"email" binding:"required"`
	Purpose string `json:"purpose" binding:"required"`
}

func (a *API) requestEmailVerification(c *gin.Context) {
	var request requestEmailVerification
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and purpose are required"})
		return
	}
	emailAddress, ok := canonicalEmail(request.Email)
	if !ok || !purposePattern.MatchString(request.Purpose) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email or verification purpose"})
		return
	}
	if request.Purpose == "login" && a.config.OwnerEmail != "" && emailAddress != strings.ToLower(strings.TrimSpace(a.config.OwnerEmail)) {
		// Keep the public response shape stable without delivering credentials to
		// arbitrary addresses. The gateway will reject confirmation because this
		// decoy challenge is never persisted.
		now := a.now().UTC()
		c.JSON(http.StatusAccepted, gin.H{"challengeId": uuid.NewString(), "expiresAt": now.Add(a.config.EmailVerificationTTL)})
		return
	}
	code, err := numericCode(6)
	if err != nil {
		a.internalError(c, "create email verification credential", err)
		return
	}
	now := a.now().UTC()
	challengeID := uuid.NewString()
	maxAttempts := a.config.EmailVerificationMaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 5
	}
	verification := model.EmailVerification{
		ID:          uuid.NewString(),
		ChallengeID: challengeID,
		Email:       emailAddress,
		Purpose:     request.Purpose,
		TokenHash:   a.hashVerificationSecret(code),
		MaxAttempts: maxAttempts,
		ExpiresAt:   now.Add(a.config.EmailVerificationTTL),
		CreatedAt:   now,
	}
	if err := a.store.CreateEmailVerification(c.Request.Context(), verification); err != nil {
		a.internalError(c, "persist email verification", err)
		return
	}
	if err := a.sender.Send(email.Message{
		To:           verification.Email,
		Subject:      "Axi Workbench verification",
		Text:         email.RenderVerificationCodeText(email.VerificationCodeParams{Purpose: verification.Purpose, Code: code, ExpiresAt: verification.ExpiresAt}),
		HTML:         email.RenderVerificationCodeHTML(email.VerificationCodeParams{Purpose: verification.Purpose, Code: code, ExpiresAt: verification.ExpiresAt}),
		InlineAssets: []email.InlineAsset{email.BrandLogoInlineAsset()},
	}); err != nil {
		a.internalError(c, "deliver email verification", err)
		return
	}
	a.audit(c, "email.verification.requested", "purpose", verification.Purpose)
	c.JSON(http.StatusAccepted, gin.H{"challengeId": verification.ChallengeID, "expiresAt": verification.ExpiresAt})
}

type confirmEmailVerification struct {
	ChallengeID string `json:"challengeId" binding:"required"`
	Token       string `json:"token" binding:"required"`
	Purpose     string `json:"purpose" binding:"required"`
}

func (a *API) confirmEmailVerification(c *gin.Context) {
	var request confirmEmailVerification
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "challengeId, purpose and a six-digit verification token are required"})
		return
	}
	request.ChallengeID = strings.TrimSpace(request.ChallengeID)
	request.Token = strings.TrimSpace(request.Token)
	request.Purpose = strings.TrimSpace(request.Purpose)
	if request.ChallengeID == "" || request.Purpose == "" || !numericCodePattern.MatchString(request.Token) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "challengeId, purpose and a six-digit verification token are required"})
		return
	}
	verification, err := a.store.ConsumeEmailVerification(c.Request.Context(), request.ChallengeID, a.hashVerificationSecret(request.Token), request.Purpose)
	if err != nil {
		switch err {
		case store.ErrNotFound, store.ErrExpired, store.ErrInvalidCredential:
			// Do not reveal whether a challenge, email, or expiry state exists.
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verification failed"})
			return
		default:
			a.domainError(c, err)
		}
		return
	}
	a.audit(c, "email.verification.confirmed", "purpose", verification.Purpose)
	c.JSON(http.StatusOK, gin.H{"email": verification.Email, "purpose": verification.Purpose, "verified": true})
}

type putEPSIdentityLinkRequest struct {
	ExternalSubject string `json:"externalSubject" binding:"required"`
	OrganizationRef string `json:"organizationRef"`
}

func (a *API) putEPSIdentityLink(c *gin.Context) {
	var request putEPSIdentityLinkRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "externalSubject is required"})
		return
	}
	now := a.now().UTC()
	link, err := a.store.UpsertEPSIdentityLink(c.Request.Context(), model.EPSIdentityLink{
		Provider:        c.Param("provider"),
		ExternalSubject: strings.TrimSpace(request.ExternalSubject),
		Subject:         c.GetHeader(trust.SubjectHeader),
		OrganizationRef: strings.TrimSpace(request.OrganizationRef),
		CreatedAt:       now,
		UpdatedAt:       now,
	})
	if err != nil {
		a.internalError(c, "upsert EPS identity link", err)
		return
	}
	a.audit(c, "eps.identity-link.upserted", "provider", link.Provider, "subject", link.Subject)
	c.JSON(http.StatusOK, link)
}

func (a *API) getEPSIdentityLink(c *gin.Context) {
	link, err := a.store.GetEPSIdentityLink(c.Request.Context(), c.Param("provider"), c.GetHeader(trust.SubjectHeader))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, link)
}

func (a *API) qrPayload(transactionID, ticket string) (string, error) {
	payloadURL, err := url.Parse(strings.TrimSuffix(a.config.PublicBaseURL, "/") + "/api/v1/auth/qr/transactions/" + transactionID + "/approve")
	if err != nil {
		return "", err
	}
	query := payloadURL.Query()
	query.Set("ticket", ticket)
	query.Set("v", "1")
	payloadURL.RawQuery = query.Encode()
	return payloadURL.String(), nil
}

func (a *API) zitadelContinueURL(transactionID, resumeToken string) (string, error) {
	continueURL, err := url.Parse(a.config.ZitadelCustomLoginURL)
	if err != nil {
		return "", err
	}
	query := continueURL.Query()
	query.Set("axi_qr_transaction", transactionID)
	query.Set("axi_qr_resume", resumeToken)
	continueURL.RawQuery = query.Encode()
	return continueURL.String(), nil
}

func (a *API) domainError(c *gin.Context, err error) {
	switch {
	case err == nil:
		return
	case err == store.ErrNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "identity record not found"})
	case err == store.ErrExpired:
		c.JSON(http.StatusGone, gin.H{"error": "identity credential has expired"})
	case err == store.ErrAlreadyConsumed:
		c.JSON(http.StatusConflict, gin.H{"error": "identity credential has already been consumed"})
	case err == store.ErrInvalidCredential:
		c.JSON(http.StatusUnauthorized, gin.H{"error": "verification token is invalid"})
	case err == store.ErrTooManyAttempts:
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "verification attempts exceeded"})
	case err == store.ErrInvalidState:
		c.JSON(http.StatusConflict, gin.H{"error": "identity transaction is not in the expected state"})
	default:
		a.internalError(c, "identity persistence", err)
	}
}

func (a *API) internalError(c *gin.Context, action string, err error) {
	a.logger.Error("identity adapter request failed", "action", action, "requestID", c.GetString("requestID"), "error", err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "identity service temporarily unavailable"})
}

func (a *API) audit(c *gin.Context, event string, attributes ...any) {
	values := []any{"event", event, "requestID", c.GetString("requestID")}
	values = append(values, attributes...)
	a.logger.Info("identity audit", values...)
}

func validPKCE(challenge, method string) bool {
	return method == "S256" && pkceChallengePattern.MatchString(challenge)
}

func canonicalEmail(value string) (string, bool) {
	value = strings.TrimSpace(value)
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value || !strings.Contains(address.Address, "@") {
		return "", false
	}
	return strings.ToLower(address.Address), true
}

func opaqueToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// numericCode generates a zero-padded decimal verification code (e.g. "042918")
// for human-typed email confirmations. Modulo bias is negligible at <10 digits.
func numericCode(digits int) (string, error) {
	if digits <= 0 || digits > 9 {
		return "", fmt.Errorf("numericCode: digits must be in 1..9, got %d", digits)
	}
	max := uint64(1)
	for i := 0; i < digits; i++ {
		max *= 10
	}
	// Rejection sampling is overkill here: 1M possibilities for 6 digits is fine
	// to keep the bias to <1 ppm. For 9 digits the worst-case bias is ~0.0001%.
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	value := binary.BigEndian.Uint64(buf) % max
	return fmt.Sprintf("%0*d", digits, value), nil
}

func hashSecret(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func (a *API) hashVerificationSecret(value string) string {
	pepper := a.config.EmailVerificationPepper
	if pepper == "" {
		pepper = "axi-development-email-pepper"
	}
	digest := hmac.New(sha256.New, []byte(pepper))
	_, _ = digest.Write([]byte(value))
	return hex.EncodeToString(digest.Sum(nil))
}

func constantTimeEqual(left, right string) bool {
	if left == "" || right == "" || len(left) != len(right) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}
