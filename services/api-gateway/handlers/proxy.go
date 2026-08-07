package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

// ProxyHandler is the gateway's narrow downstream boundary. It removes every
// client-controlled internal identity header before injecting a verified OIDC
// subject and a per-service internal credential.
type ProxyHandler struct {
	identityAdapterURL        string
	platformCoreURL           string
	legacyCoreServiceURL      string
	fileServiceURL            string
	workflowURL               string
	notificationURL           string
	identityInternalToken     string
	platformInternalToken     string
	fileInternalToken         string
	workflowInternalToken     string
	notificationInternalToken string
}

func NewProxyHandler(
	identityAdapterURL string,
	platformCoreURL string,
	legacyCoreServiceURL string,
	fileServiceURL string,
	workflowURL string,
	notificationURL string,
	identityInternalToken string,
	platformInternalToken string,
	fileInternalToken string,
	workflowInternalToken string,
	notificationInternalToken string,
) *ProxyHandler {
	return &ProxyHandler{
		identityAdapterURL:        identityAdapterURL,
		platformCoreURL:           platformCoreURL,
		legacyCoreServiceURL:      legacyCoreServiceURL,
		fileServiceURL:            fileServiceURL,
		workflowURL:               workflowURL,
		notificationURL:           notificationURL,
		identityInternalToken:     identityInternalToken,
		platformInternalToken:     platformInternalToken,
		fileInternalToken:         fileInternalToken,
		workflowInternalToken:     workflowInternalToken,
		notificationInternalToken: notificationInternalToken,
	}
}

func (p *ProxyHandler) ProxyToIdentity() gin.HandlerFunc {
	return p.createProxy(p.identityAdapterURL, p.identityInternalToken, "", "")
}

func (p *ProxyHandler) ProxyToPlatform() gin.HandlerFunc {
	return p.createProxy(p.platformCoreURL, p.platformInternalToken, "", "")
}

func (p *ProxyHandler) ProxyToLegacyCore() gin.HandlerFunc {
	return p.createProxy(p.legacyCoreServiceURL, "", "", "")
}

func (p *ProxyHandler) ProxyToFile() gin.HandlerFunc {
	return p.createProxy(p.fileServiceURL, p.fileInternalToken, "/api/v1/files", "/files")
}

func (p *ProxyHandler) ProxyToWorkflow() gin.HandlerFunc {
	return p.createProxy(p.workflowURL, p.workflowInternalToken, "/api/v1/workflows", "/workflows")
}

func (p *ProxyHandler) ProxyToNotification() gin.HandlerFunc {
	return p.createProxy(p.notificationURL, p.notificationInternalToken, "", "")
}

func (p *ProxyHandler) createProxy(targetURL, internalToken, externalPrefix, downstreamPrefix string) gin.HandlerFunc {
	target, err := url.Parse(targetURL)
	if err != nil || target.Scheme == "" || target.Host == "" {
		return func(c *gin.Context) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "downstream service is not configured"})
		}
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = target.Host
		rewritePath(request.URL, externalPrefix, downstreamPrefix)
	}
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, proxyErr error) {
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte(`{"error":"downstream service unavailable"}`))
	}

	return func(c *gin.Context) {
		request := c.Request.Clone(c.Request.Context())
		stripUntrustedInternalHeaders(request.Header)
		if principal, ok := middleware.PrincipalFromContext(c); ok {
			request.Header.Set("X-Axi-Subject", principal.Subject)
			request.Header.Set("X-User-Id", principal.Subject)
			if principal.Email != "" {
				request.Header.Set("X-Axi-Email", principal.Email)
			}
		}
		if internalToken != "" {
			request.Header.Set("X-Axi-Internal-Token", internalToken)
		}
		proxy.ServeHTTP(c.Writer, request)
	}
}

func rewritePath(requestURL *url.URL, externalPrefix, downstreamPrefix string) {
	if requestURL == nil || externalPrefix == "" {
		return
	}
	path := requestURL.Path
	if path == externalPrefix {
		requestURL.Path = downstreamPrefix
	} else if strings.HasPrefix(path, externalPrefix+"/") {
		requestURL.Path = downstreamPrefix + strings.TrimPrefix(path, externalPrefix)
	}
	requestURL.RawPath = ""
}

func stripUntrustedInternalHeaders(headers http.Header) {
	for _, header := range []string{
		"Authorization",
		"X-Axi-Internal-Token",
		"X-Axi-Subject",
		"X-Axi-Tenant-ID",
		"X-Axi-Email",
		"X-Axi-Development-Subject",
		"X-Axi-Development-Email",
		"X-User-Id",
	} {
		headers.Del(header)
	}
	for key := range headers {
		if strings.HasPrefix(strings.ToLower(key), "x-axi-internal-") {
			headers.Del(key)
		}
	}
}

func NotFoundHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Not Found",
			"message": "The requested resource was not found",
		})
	}
}
