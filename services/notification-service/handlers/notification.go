package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"notification-service/middleware"
	"notification-service/models"
	"notification-service/services"
)

type NotificationHandler struct {
	service *services.NotificationService
}

func NewNotificationHandler(service *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

func (h *NotificationHandler) CreateNotification(c *gin.Context) {
	var req models.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	subject := middleware.Subject(c)
	if req.UserID == "" {
		req.UserID = subject
	} else if req.UserID != subject {
		c.JSON(http.StatusForbidden, gin.H{"error": "userId must match the verified subject"})
		return
	}

	notification, err := h.service.CreateNotificationContext(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID, ok := resolveScopedUserID(c)
	if !ok {
		return
	}
	unreadOnly := c.Query("unreadOnly") == "true" || c.Query("unread") == "1"
	notifications, err := h.service.ListNotificationsContext(c.Request.Context(), userID, unreadOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load notifications"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

// GetNavBadges returns bottom-tab badges for the mobile chrome.
// GET /api/v1/notifications/nav-badges?userId=demo
func (h *NotificationHandler) GetNavBadges(c *gin.Context) {
	userID, ok := resolveScopedUserID(c)
	if !ok {
		return
	}
	badges, err := h.service.GetNavBadgesContext(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load notification badges"})
		return
	}
	c.JSON(http.StatusOK, badges)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	n, err := h.service.MarkReadContext(c.Request.Context(), id, middleware.Subject(c))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, n)
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, ok := resolveScopedUserID(c)
	if !ok {
		return
	}
	count, err := h.service.MarkAllReadContext(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark notifications read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"marked": count})
}

// ResolveUserID is a helper for tests / future auth middleware.
func ResolveUserID(c *gin.Context) string {
	if subject := middleware.Subject(c); subject != "" {
		return subject
	}
	return ""
}

func resolveScopedUserID(c *gin.Context) (string, bool) {
	subject := middleware.Subject(c)
	requested := strings.TrimSpace(c.Query("userId"))
	if requested != "" && requested != subject {
		c.JSON(http.StatusForbidden, gin.H{"error": "userId must match the verified subject"})
		return "", false
	}
	return subject, true
}
