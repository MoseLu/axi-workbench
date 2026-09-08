package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

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

// ProxyToEventConsumers fans one Platform Core outbox delivery to both
// specialist consumers. The platform worker has one delivery URL, while the
// gateway owns the downstream service boundary and dedicated credentials.
// A delivery succeeds only when both consumers acknowledge it.
func (p *ProxyHandler) ProxyToEventConsumers() gin.HandlerFunc {
	client := &http.Client{Timeout: 10 * time.Second}
	type consumer struct {
		name  string
		base  string
		token string
	}
	consumers := []consumer{
		{name: "notification", base: p.notificationURL, token: p.notificationInternalToken},
		{name: "workflow", base: p.workflowURL, token: p.workflowInternalToken},
	}

	return func(c *gin.Context) {
		body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2<<20))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event body"})
			return
		}
		failures := make([]string, 0, len(consumers))
		for _, consumer := range consumers {
			if err := forwardEvent(c, client, consumer.base, consumer.token, body); err != nil {
				failures = append(failures, consumer.name)
			}
		}
		if len(failures) > 0 {
			c.JSON(http.StatusBadGateway, gin.H{"error": "event consumer unavailable", "consumers": failures})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func forwardEvent(c *gin.Context, client *http.Client, baseURL, internalToken string, body []byte) error {
	target, err := url.Parse(baseURL)
	if err != nil || target.Scheme == "" || target.Host == "" {
		return fmt.Errorf("event consumer is not configured")
	}
	target.Path = strings.TrimSuffix(target.Path, "/") + "/internal/events"
	target.RawQuery = ""
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, target.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Host = target.Host
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Axi-Internal-Token", internalToken)
	for _, header := range []string{"X-Axi-Event-ID", "X-Axi-Event-Topic", "X-Axi-Delivery-Attempt", "X-Request-ID", "traceparent"} {
		if value := c.GetHeader(header); value != "" {
			request.Header.Set(header, value)
		}
	}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("event consumer returned HTTP %d", response.StatusCode)
	}
	return nil
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
