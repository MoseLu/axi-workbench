package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/axi-workbench/platform-core/internal/config"
	"github.com/axi-workbench/platform-core/internal/store"
	"github.com/gin-gonic/gin"
)

func TestTenantBoundaryRejectsForgedTenantContext(t *testing.T) {
	router := newTestRouter()
	aliceHeaders := trustedHeaders("zitadel-alice")

	createdTenant := performJSON(t, router, http.MethodPost, "/api/v1/tenants", map[string]string{
		"name": "Alice Workspace",
		"slug": "alice-workspace",
	}, aliceHeaders)
	if createdTenant.Code != http.StatusCreated {
		t.Fatalf("create tenant = %d, body=%s", createdTenant.Code, createdTenant.Body.String())
	}
	var tenant struct {
		ID string `json:"id"`
	}
	decodeJSON(t, createdTenant, &tenant)
	if tenant.ID == "" {
		t.Fatal("created tenant did not return an ID")
	}

	projectPath := "/api/v1/tenants/" + tenant.ID + "/projects"
	project := performJSON(t, router, http.MethodPost, projectPath, map[string]string{"name": "Private project"}, aliceHeaders)
	if project.Code != http.StatusCreated {
		t.Fatalf("owner create project = %d, body=%s", project.Code, project.Body.String())
	}

	bobHeaders := trustedHeaders("zitadel-bob")
	bobHeaders["X-Axi-Tenant-ID"] = tenant.ID // malicious client header must be ignored by platform-core
	foreignRead := performJSON(t, router, http.MethodGet, projectPath, nil, bobHeaders)
	if foreignRead.Code != http.StatusForbidden {
		t.Fatalf("cross-tenant project read = %d, want %d; body=%s", foreignRead.Code, http.StatusForbidden, foreignRead.Body.String())
	}
	foreignWrite := performJSON(t, router, http.MethodPost, projectPath, map[string]string{"name": "Forged"}, bobHeaders)
	if foreignWrite.Code != http.StatusForbidden {
		t.Fatalf("cross-tenant project write = %d, want %d; body=%s", foreignWrite.Code, http.StatusForbidden, foreignWrite.Body.String())
	}

	direct := performJSON(t, router, http.MethodGet, projectPath, nil, map[string]string{"X-Axi-Subject": "zitadel-alice"})
	if direct.Code != http.StatusUnauthorized {
		t.Fatalf("direct platform request = %d, want %d", direct.Code, http.StatusUnauthorized)
	}
}

func TestPreferencesAndDictionaryUseAuthenticatedSubjectAndTenant(t *testing.T) {
	router := newTestRouter()
	ownerHeaders := trustedHeaders("zitadel-owner")
	createdTenant := performJSON(t, router, http.MethodPost, "/api/v1/tenants", map[string]string{
		"name": "Owner Workspace",
		"slug": "owner-workspace",
	}, ownerHeaders)
	var tenant struct {
		ID string `json:"id"`
	}
	decodeJSON(t, createdTenant, &tenant)

	preferences := performJSON(t, router, http.MethodPatch, "/api/v1/me/preferences", map[string]any{
		"locale":             "en-US",
		"theme":              "dark",
		"timezone":           "UTC",
		"notificationsMuted": true,
	}, ownerHeaders)
	if preferences.Code != http.StatusOK || !strings.Contains(preferences.Body.String(), "en-US") {
		t.Fatalf("update preferences = %d, body=%s", preferences.Code, preferences.Body.String())
	}

	dictionaryPath := "/api/v1/tenants/" + tenant.ID + "/dictionaries/statuses"
	first := performJSON(t, router, http.MethodPut, dictionaryPath, map[string]any{"entries": map[string]string{"todo": "To do"}}, ownerHeaders)
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), `"version":1`) {
		t.Fatalf("create dictionary = %d, body=%s", first.Code, first.Body.String())
	}
	second := performJSON(t, router, http.MethodPut, dictionaryPath, map[string]any{"entries": map[string]string{"done": "Done"}}, ownerHeaders)
	if second.Code != http.StatusOK || !strings.Contains(second.Body.String(), `"version":2`) {
		t.Fatalf("versioned dictionary update = %d, body=%s", second.Code, second.Body.String())
	}
}

func newTestRouter() *gin.Engine {
	cfg := config.Config{InternalServiceToken: "platform-test-token"}
	return New(cfg, store.NewMemory(nil), slog.New(slog.NewTextHandler(bytes.NewBuffer(nil), nil))).Router()
}

func trustedHeaders(subject string) map[string]string {
	return map[string]string{
		"X-Axi-Internal-Token": "platform-test-token",
		"X-Axi-Subject":        subject,
	}
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
