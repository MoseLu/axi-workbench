package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

// MobileControlProxy is the only public ingress to the Control Plane mobile
// API.  It deliberately preserves a short-lived *device* bearer for the
// Control Plane to verify, while removing every caller-supplied internal
// header before adding the Gateway credential.  Browser/mobile code therefore
// never calls a Control Plane port directly.
type MobileControlProxy struct {
	target        *url.URL
	internalToken string
}

func NewMobileControlProxy(targetURL, internalToken string) *MobileControlProxy {
	target, err := url.Parse(targetURL)
	if err != nil || target.Scheme == "" || target.Host == "" {
		return &MobileControlProxy{}
	}
	return &MobileControlProxy{target: target, internalToken: internalToken}
}

func (p *MobileControlProxy) Proxy() gin.HandlerFunc {
	if p.target == nil || p.internalToken == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mobile control plane is not configured"})
		}
	}
	proxy := httputil.NewSingleHostReverseProxy(p.target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = p.target.Host
		request.URL.Path = "/internal/mobile/v1" + strings.TrimPrefix(request.URL.Path, "/api/v1/mobile")
		request.URL.RawPath = ""
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, _ error) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"mobile control plane unavailable"}`))
	}

	return func(c *gin.Context) {
		request := c.Request.Clone(c.Request.Context())
		// The device token is verified downstream.  It is the one exception to
		// the normal proxy header scrubber; all internal/identity headers remain
		// untrusted and are removed before the Gateway credential is added.
		deviceAuthorization := request.Header.Get("Authorization")
		stripUntrustedInternalHeaders(request.Header)
		if strings.HasPrefix(deviceAuthorization, "Bearer ") {
			request.Header.Set("Authorization", deviceAuthorization)
		}
		request.Header.Set("X-Axi-Internal-Token", p.internalToken)
		proxy.ServeHTTP(c.Writer, request)
	}
}

// ProxyWebHandoff is a browser-session protected continuation endpoint.  The
// Gateway, not the browser, supplies the verified subject to the internal
// Control Plane; every final handoff action stays tied to the same correlation
// record created by Mobile.
func (p *MobileControlProxy) ProxyWebHandoff() gin.HandlerFunc {
	if p.target == nil || p.internalToken == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "control plane is not configured"})
		}
	}
	proxy := httputil.NewSingleHostReverseProxy(p.target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = p.target.Host
		request.URL.Path = "/internal/web/v1/handoffs" + strings.TrimPrefix(request.URL.Path, "/api/v1/handoffs")
		request.URL.RawPath = ""
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, _ error) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"control plane unavailable"}`))
	}
	return func(c *gin.Context) {
		request := c.Request.Clone(c.Request.Context())
		stripUntrustedInternalHeaders(request.Header)
		principal, ok := middleware.PrincipalFromContext(c)
		if !ok || principal.Subject == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verified identity required"})
			return
		}
		request.Header.Set("X-Axi-Subject", principal.Subject)
		request.Header.Set("X-Axi-Internal-Token", p.internalToken)
		proxy.ServeHTTP(c.Writer, request)
	}
}

// ProxyWebControl exposes the browser control-plane read/write API only after
// the Gateway has established an HttpOnly session. The browser never receives
// the control-plane internal credential and cannot spoof the subject header.
func (p *MobileControlProxy) ProxyWebControl() gin.HandlerFunc {
	if p.target == nil || p.internalToken == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "control plane is not configured"})
		}
	}
	proxy := httputil.NewSingleHostReverseProxy(p.target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = p.target.Host
		request.URL.Path = "/internal/web/v1" + strings.TrimPrefix(request.URL.Path, "/api/v1/control-plane")
		request.URL.RawPath = ""
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, _ error) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"control plane unavailable"}`))
	}
	return func(c *gin.Context) {
		request := c.Request.Clone(c.Request.Context())
		stripUntrustedInternalHeaders(request.Header)
		principal, ok := middleware.PrincipalFromContext(c)
		if !ok || principal.Subject == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "verified identity required"})
			return
		}
		request.Header.Set("X-Axi-Subject", principal.Subject)
		if principal.Email != "" {
			request.Header.Set("X-Axi-Email", principal.Email)
		}
		request.Header.Set("X-Axi-Internal-Token", p.internalToken)
		proxy.ServeHTTP(c.Writer, request)
	}
}

// ProxyPublicWebLogin forwards only the anonymous half of the device-QR
// login transaction. The browser supplies a one-time polling bearer, while
// the Gateway strips browser cookies, bearer tokens, and every spoofable
// identity header before adding its own service credential. A Control Plane
// response from this route never contains an owner principal.
func (p *MobileControlProxy) ProxyPublicWebLogin() gin.HandlerFunc {
	if p.target == nil || p.internalToken == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "control plane is not configured"})
		}
	}
	proxy := httputil.NewSingleHostReverseProxy(p.target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = p.target.Host
		request.URL.Path = "/internal/gateway/v1/web-login/qr" + strings.TrimPrefix(request.URL.Path, "/api/v1/auth/device-login/qr")
		request.URL.RawPath = ""
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, _ error) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"control plane unavailable"}`))
	}

	return func(c *gin.Context) {
		request := c.Request.Clone(c.Request.Context())
		pollToken := strings.TrimSpace(request.Header.Get("X-Axi-QR-Poll-Token"))
		stripUntrustedInternalHeaders(request.Header)
		request.Header.Del("Cookie")
		request.Header.Del("X-Axi-QR-Poll-Token")
		if pollToken != "" {
			request.Header.Set("X-Axi-QR-Poll-Token", pollToken)
		}
		request.Header.Set("X-Axi-Internal-Token", p.internalToken)
		proxy.ServeHTTP(c.Writer, request)
	}
}

type webLoginConsumeGrant struct {
	OK           bool   `json:"ok"`
	Status       string `json:"status"`
	OwnerSubject string `json:"ownerSubject"`
	OwnerEmail   string `json:"ownerEmail"`
	DeviceName   string `json:"deviceName"`
}

// ConsumeWebLogin turns a Control Plane one-time device approval into the
// Gateway's durable HttpOnly browser cookie. It is intentionally not a
// transparent proxy: the owner identity stays on the private service hop and
// only the Gateway can mint the browser session.
func (p *MobileControlProxy) ConsumeWebLogin(service *identity.Service) gin.HandlerFunc {
	if p.target == nil || p.internalToken == "" || service == nil {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "device QR login is not configured"})
		}
	}
	client := &http.Client{Timeout: 10 * time.Second}
	return func(c *gin.Context) {
		webLoginID := c.Param("id")
		if !webLoginIDPattern.MatchString(webLoginID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device QR transaction"})
			return
		}
		pollToken := strings.TrimSpace(c.GetHeader("X-Axi-QR-Poll-Token"))
		if pollToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "device QR poll token is required"})
			return
		}

		target := *p.target
		target.Path = strings.TrimRight(target.Path, "/") + "/internal/gateway/v1/web-login/qr/" + url.PathEscape(webLoginID) + "/consume"
		target.RawPath = ""
		target.RawQuery = ""
		request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, target.String(), bytes.NewBufferString("{}"))
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "device QR login cannot be completed"})
			return
		}
		request.Host = target.Host
		request.Header.Set("Accept", "application/json")
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("X-Axi-QR-Poll-Token", pollToken)
		request.Header.Set("X-Axi-Internal-Token", p.internalToken)
		response, err := client.Do(request)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "control plane unavailable"})
			return
		}
		defer response.Body.Close()
		raw, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
		if response.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadRequest, gin.H{"error": "device QR login cannot be completed"})
			return
		}
		var grant webLoginConsumeGrant
		if err := json.Unmarshal(raw, &grant); err != nil || !grant.OK || grant.Status != "approved" || strings.TrimSpace(grant.OwnerSubject) == "" {
			c.JSON(http.StatusBadGateway, gin.H{"error": "invalid device QR login grant"})
			return
		}
		principal := identity.Principal{
			Subject: strings.TrimSpace(grant.OwnerSubject),
			Email:   strings.TrimSpace(grant.OwnerEmail),
		}
		sessionID, err := service.IssuePrincipalSession(c.Request.Context(), principal)
		if err != nil {
			if errors.Is(err, identity.ErrSessionStoreUnavailable) || errors.Is(err, identity.ErrUnavailable) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "session store unavailable"})
				return
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "device QR identity was rejected"})
			return
		}
		service.SetCookie(c.Writer, sessionID)
		c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": principal})
	}
}

var webLoginIDPattern = regexp.MustCompile(`^weblogin_[A-Za-z0-9_-]{16,}$`)
