package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/axi-workbench/identity-adapter/internal/config"
	"github.com/axi-workbench/identity-adapter/internal/email"
	"github.com/axi-workbench/identity-adapter/internal/store"
	"github.com/gin-gonic/gin"
)

type captureSender struct {
	messages []email.Message
}

func (s *captureSender) Send(message email.Message) error {
	s.messages = append(s.messages, message)
	return nil
}

func TestQRTransactionNeverReturnsOIDCTokensAndCannotReplay(t *testing.T) {
	current := time.Date(2026, 8, 7, 1, 0, 0, 0, time.UTC)
	sender := &captureSender{}
	router := newTestRouter(&current, sender)

	start := performJSON(t, router, http.MethodPost, "/api/v1/auth/qr/transactions", map[string]string{
		"clientId":            "axi-workbench-web",
		"redirectUri":         "https://web.axi.test/auth/callback",
		"codeChallenge":       strings.Repeat("a", 43),
		"codeChallengeMethod": "S256",
		"state":               "browser-state",
	}, nil)
	if start.Code != http.StatusCreated {
		t.Fatalf("start QR status = %d, body=%s", start.Code, start.Body.String())
	}
	var started struct {
		TransactionID string `json:"transactionId"`
		QRPayload     string `json:"qrPayload"`
		PollToken     string `json:"pollToken"`
	}
	decodeJSON(t, start, &started)
	if started.TransactionID == "" || started.PollToken == "" {
		t.Fatalf("expected browser transaction and poll credentials: %#v", started)
	}
	payloadURL, err := url.Parse(started.QRPayload)
	if err != nil {
		t.Fatalf("parse QR payload: %v", err)
	}
	ticket := payloadURL.Query().Get("ticket")
	if ticket == "" {
		t.Fatal("QR payload did not contain opaque approval ticket")
	}

	pollPath := "/api/v1/auth/qr/transactions/" + started.TransactionID
	unauthenticatedPoll := performJSON(t, router, http.MethodGet, pollPath, nil, nil)
	if unauthenticatedPoll.Code != http.StatusUnauthorized {
		t.Fatalf("poll without browser credential = %d", unauthenticatedPoll.Code)
	}
	pollHeaders := map[string]string{"X-Axi-QR-Poll-Token": started.PollToken}
	pendingPoll := performJSON(t, router, http.MethodGet, pollPath, nil, pollHeaders)
	if pendingPoll.Code != http.StatusOK || strings.Contains(strings.ToLower(pendingPoll.Body.String()), "token") || strings.Contains(strings.ToLower(pendingPoll.Body.String()), "jwt") {
		t.Fatalf("poll must only return status, got %d %s", pendingPoll.Code, pendingPoll.Body.String())
	}

	approvePath := pollPath + "/approve"
	directApproval := performJSON(t, router, http.MethodPost, approvePath, map[string]string{"ticket": ticket}, nil)
	if directApproval.Code != http.StatusUnauthorized {
		t.Fatalf("direct approval = %d, want %d", directApproval.Code, http.StatusUnauthorized)
	}
	approvalHeaders := map[string]string{
		"X-Axi-Internal-Token": "gateway-test-token",
		"X-Axi-Subject":        "zitadel-subject-1",
	}
	approval := performJSON(t, router, http.MethodPost, approvePath, map[string]string{"ticket": ticket}, approvalHeaders)
	if approval.Code != http.StatusAccepted {
		t.Fatalf("approve QR status = %d, body=%s", approval.Code, approval.Body.String())
	}
	approvedPoll := performJSON(t, router, http.MethodGet, pollPath, nil, pollHeaders)
	if approvedPoll.Code != http.StatusOK || !strings.Contains(approvedPoll.Body.String(), "approved") || strings.Contains(strings.ToLower(approvedPoll.Body.String()), "subject") {
		t.Fatalf("approved poll leaked data or missed status: %s", approvedPoll.Body.String())
	}

	resume := performJSON(t, router, http.MethodPost, pollPath+"/resume", nil, pollHeaders)
	if resume.Code != http.StatusOK || strings.Contains(strings.ToLower(resume.Body.String()), "authorizationcode") || strings.Contains(strings.ToLower(resume.Body.String()), "access_token") {
		t.Fatalf("resume must only hand off to ZITADEL, got %d %s", resume.Code, resume.Body.String())
	}
	var resumed struct {
		ContinueURL string `json:"continueUrl"`
	}
	decodeJSON(t, resume, &resumed)
	continuation, err := url.Parse(resumed.ContinueURL)
	if err != nil {
		t.Fatalf("parse continuation URL: %v", err)
	}
	resumeToken := continuation.Query().Get("axi_qr_resume")
	if resumeToken == "" {
		t.Fatal("expected one-time resume token in custom-login handoff")
	}

	completePath := "/api/v1/internal/zitadel/qr/transactions/" + started.TransactionID + "/complete"
	completionHeaders := map[string]string{"X-Axi-Zitadel-Webhook": "zitadel-test-webhook"}
	completion := performJSON(t, router, http.MethodPost, completePath, map[string]string{"resumeToken": resumeToken}, completionHeaders)
	if completion.Code != http.StatusOK || strings.Contains(strings.ToLower(completion.Body.String()), "token") {
		t.Fatalf("custom-login completion must only return OIDC request context: %d %s", completion.Code, completion.Body.String())
	}
	replay := performJSON(t, router, http.MethodPost, completePath, map[string]string{"resumeToken": resumeToken}, completionHeaders)
	if replay.Code != http.StatusConflict {
		t.Fatalf("replayed resume credential = %d, want %d", replay.Code, http.StatusConflict)
	}
}

func TestEmailVerificationIsSingleUse(t *testing.T) {
	current := time.Date(2026, 8, 7, 1, 0, 0, 0, time.UTC)
	sender := &captureSender{}
	router := newTestRouter(&current, sender)

	request := performJSON(t, router, http.MethodPost, "/api/v1/auth/email-verifications", map[string]string{
		"email":   "team@axi.test",
		"purpose": "signup",
	}, nil)
	if request.Code != http.StatusAccepted || len(sender.messages) != 1 {
		t.Fatalf("email request = %d, messages=%d", request.Code, len(sender.messages))
	}
	match := regexp.MustCompile(`token for signup: ([^\s]+)`).FindStringSubmatch(sender.messages[0].Text)
	if len(match) != 2 {
		t.Fatalf("could not extract test verification token from message")
	}
	confirm := performJSON(t, router, http.MethodPost, "/api/v1/auth/email-verifications/confirm", map[string]string{"token": match[1]}, nil)
	if confirm.Code != http.StatusOK {
		t.Fatalf("confirm email = %d, body=%s", confirm.Code, confirm.Body.String())
	}
	replay := performJSON(t, router, http.MethodPost, "/api/v1/auth/email-verifications/confirm", map[string]string{"token": match[1]}, nil)
	if replay.Code != http.StatusConflict {
		t.Fatalf("replayed email token = %d, want %d", replay.Code, http.StatusConflict)
	}
}

func TestQRTransactionExpiresBeforeApproval(t *testing.T) {
	current := time.Date(2026, 8, 7, 1, 0, 0, 0, time.UTC)
	sender := &captureSender{}
	router := newTestRouterWithTTL(&current, sender, time.Minute)
	start := performJSON(t, router, http.MethodPost, "/api/v1/auth/qr/transactions", map[string]string{
		"clientId":            "axi-workbench-web",
		"redirectUri":         "https://web.axi.test/auth/callback",
		"codeChallenge":       strings.Repeat("b", 43),
		"codeChallengeMethod": "S256",
	}, nil)
	var started struct {
		TransactionID string `json:"transactionId"`
		QRPayload     string `json:"qrPayload"`
	}
	decodeJSON(t, start, &started)
	payloadURL, _ := url.Parse(started.QRPayload)
	current = current.Add(2 * time.Minute)
	approval := performJSON(t, router, http.MethodPost, "/api/v1/auth/qr/transactions/"+started.TransactionID+"/approve", map[string]string{"ticket": payloadURL.Query().Get("ticket")}, map[string]string{
		"X-Axi-Internal-Token": "gateway-test-token",
		"X-Axi-Subject":        "zitadel-subject-1",
	})
	if approval.Code != http.StatusGone {
		t.Fatalf("expired approval = %d, want %d", approval.Code, http.StatusGone)
	}
}

func newTestRouter(current *time.Time, sender email.Sender) *gin.Engine {
	return newTestRouterWithTTL(current, sender, 2*time.Minute)
}

func newTestRouterWithTTL(current *time.Time, sender email.Sender, qrTTL time.Duration) *gin.Engine {
	cfg := config.Config{
		InternalServiceToken:  "gateway-test-token",
		ZitadelWebhookSecret:  "zitadel-test-webhook",
		PublicBaseURL:         "https://api.axi.test",
		ZitadelCustomLoginURL: "https://id.axi.test/login",
		AllowedRedirectURIs:   []string{"https://web.axi.test/auth/callback"},
		QRTransactionTTL:      qrTTL,
		EmailVerificationTTL:  15 * time.Minute,
	}
	persistence := store.NewMemory(func() time.Time { return *current })
	return New(cfg, persistence, sender, func() time.Time { return *current }, slog.New(slog.NewTextHandler(bytes.NewBuffer(nil), nil))).Router()
}

func performJSON(t *testing.T, router http.Handler, method, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var content []byte
	if body != nil {
		var err error
		content, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(content))
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func decodeJSON(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.Unmarshal(response.Body.Bytes(), target); err != nil {
		t.Fatalf("decode response JSON %q: %v", response.Body.String(), err)
	}
}
