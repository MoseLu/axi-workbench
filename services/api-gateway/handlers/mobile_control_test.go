package handlers

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/epap/api-gateway/config"
	"github.com/epap/api-gateway/identity"
	"github.com/gin-gonic/gin"
)

const testWebLoginID = "weblogin_a8e4d721-388a-4b17-90fa-170a91dd9e4d"

func mobileControlIdentityService() *identity.Service {
	return identity.NewForTest(config.IdentityConfig{
		SessionCookieName:  "axi_session",
		SessionTTL:         8 * time.Hour,
		SessionIdleTTL:     time.Hour,
		SessionAbsoluteTTL: 4 * time.Hour,
	}, identity.NewMemoryRecordStore(nil), nil, nil)
}

func TestPublicWebLoginProxyForwardsOnlyThePollingBearer(t *testing.T) {
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/internal/gateway/v1/web-login/qr/"+testWebLoginID {
			t.Errorf("downstream path = %q", request.URL.Path)
		}
		if got := request.Header.Get("X-Axi-Internal-Token"); got != "control-plane-test-token" {
			t.Errorf("internal token = %q", got)
		}
		if got := request.Header.Get("X-Axi-QR-Poll-Token"); got != "browser-poll-token" {
			t.Errorf("poll token = %q", got)
		}
		for _, header := range []string{"Authorization", "Cookie", "X-Axi-Subject", "X-Axi-Email", "X-Axi-Development-Subject"} {
			if got := request.Header.Get(header); got != "" {
				t.Errorf("untrusted %s was forwarded: %q", header, got)
			}
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"ok":true,"status":"waiting_scan"}`)
	}))
	defer downstream.Close()

	proxy := NewMobileControlProxy(downstream.URL, "control-plane-test-token")
	router := gin.New()
	router.GET("/api/v1/auth/device-login/qr/:id", proxy.ProxyPublicWebLogin())
	gateway := httptest.NewServer(router)
	defer gateway.Close()

	request, err := http.NewRequest(http.MethodGet, gateway.URL+"/api/v1/auth/device-login/qr/"+testWebLoginID, nil)
	if err != nil {
		t.Fatalf("create public QR request: %v", err)
	}
	request.Header.Set("X-Axi-QR-Poll-Token", "browser-poll-token")
	request.Header.Set("Authorization", "Bearer attacker-token")
	request.Header.Set("X-Axi-Subject", "attacker")
	request.Header.Set("X-Axi-Email", "attacker@example.test")
	request.Header.Set("X-Axi-Development-Subject", "attacker")
	request.AddCookie(&http.Cookie{Name: "axi_session", Value: "browser-cookie"})
	response, err := gateway.Client().Do(request)
	if err != nil {
		t.Fatalf("call public QR endpoint: %v", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("public web login proxy status = %d", response.StatusCode)
	}
}

func TestConsumeWebLoginMintsOnlyAGatewayBrowserCookie(t *testing.T) {
	downstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/internal/gateway/v1/web-login/qr/"+testWebLoginID+"/consume" {
			t.Errorf("downstream request = %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("X-Axi-Internal-Token"); got != "control-plane-test-token" {
			t.Errorf("internal token = %q", got)
		}
		if got := request.Header.Get("X-Axi-QR-Poll-Token"); got != "browser-poll-token" {
			t.Errorf("poll token = %q", got)
		}
		if got := request.Header.Get("Cookie"); got != "" {
			t.Errorf("browser cookie leaked to control plane: %q", got)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(writer, `{"ok":true,"status":"approved","ownerSubject":"owner-subject","ownerEmail":"owner@example.test","deviceName":"physical-android"}`)
	}))
	defer downstream.Close()

	service := mobileControlIdentityService()
	proxy := NewMobileControlProxy(downstream.URL, "control-plane-test-token")
	router := gin.New()
	router.POST("/api/v1/auth/device-login/qr/:id/consume", proxy.ConsumeWebLogin(service))

	request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/device-login/qr/"+testWebLoginID+"/consume", nil)
	request.Header.Set("X-Axi-QR-Poll-Token", "browser-poll-token")
	request.AddCookie(&http.Cookie{Name: "axi_session", Value: "old-browser-cookie"})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("consume status = %d, body=%s", recorder.Code, recorder.Body.String())
	}
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "axi_session" || cookies[0].Value == "" || !cookies[0].HttpOnly {
		t.Fatalf("issued browser cookie = %#v", cookies)
	}
	restore := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	restore.AddCookie(cookies[0])
	principal, _, err := service.RestoreSession(context.Background(), restore)
	if err != nil || principal.Subject != "owner-subject" || principal.Email != "owner@example.test" {
		t.Fatalf("restored trusted-device principal = %#v, %v", principal, err)
	}
}
