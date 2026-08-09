package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

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
