package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

// ProxyHandler handles proxying requests to backend services
type ProxyHandler struct {
	authServiceURL  string
	coreServiceURL  string
	fileServiceURL  string
	workflowURL     string
	notificationURL string
}

// NewProxyHandler creates a new proxy handler
func NewProxyHandler(authURL, coreURL, fileURL, workflowURL, notificationURL string) *ProxyHandler {
	return &ProxyHandler{
		authServiceURL:  authURL,
		coreServiceURL:  coreURL,
		fileServiceURL:  fileURL,
		workflowURL:     workflowURL,
		notificationURL: notificationURL,
	}
}

// ProxyToAuth proxies requests to auth service
func (p *ProxyHandler) ProxyToAuth() gin.HandlerFunc {
	return p.createProxy(p.authServiceURL)
}

// ProxyToCore proxies requests to core service
func (p *ProxyHandler) ProxyToCore() gin.HandlerFunc {
	return p.createProxy(p.coreServiceURL)
}

// ProxyToFile proxies requests to file service
func (p *ProxyHandler) ProxyToFile() gin.HandlerFunc {
	return p.createProxy(p.fileServiceURL)
}

// ProxyToWorkflow proxies requests to workflow service
func (p *ProxyHandler) ProxyToWorkflow() gin.HandlerFunc {
	return p.createProxy(p.workflowURL)
}

// ProxyToNotification proxies requests to notification service
func (p *ProxyHandler) ProxyToNotification() gin.HandlerFunc {
	return p.createProxy(p.notificationURL)
}

func (p *ProxyHandler) createProxy(targetURL string) gin.HandlerFunc {
	target, err := url.Parse(targetURL)
	if err != nil {
		return func(c *gin.Context) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid target URL"})
		}
	}
	return func(c *gin.Context) {
		// Create reverse proxy
		proxy := httputil.NewSingleHostReverseProxy(target)

		// Set headers
		c.Request.Host = target.Host

		// Forward the request
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// NotFoundHandler handles undefined routes
func NotFoundHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Not Found",
			"message": "The requested resource was not found",
		})
	}
}
