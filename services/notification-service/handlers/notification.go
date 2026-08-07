package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
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

	notification, err := h.service.CreateNotification(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, notification)
}

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID := c.Query("userId")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
	}
	unreadOnly := c.Query("unreadOnly") == "true" || c.Query("unread") == "1"
	notifications := h.service.ListNotifications(userID, unreadOnly)
	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

// GetNavBadges returns bottom-tab badges for the mobile chrome.
// GET /api/v1/notifications/nav-badges?userId=demo
func (h *NotificationHandler) GetNavBadges(c *gin.Context) {
	userID := c.Query("userId")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
	}
	if userID == "" {
		// Default demo user so clients without auth still get seeded badges.
		userID = "demo"
	}
	c.JSON(http.StatusOK, h.service.GetNavBadges(userID))
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}
	n, err := h.service.MarkRead(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, n)
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID := c.Query("userId")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
	}
	count := h.service.MarkAllRead(userID)
	c.JSON(http.StatusOK, gin.H{"marked": count})
}

// ResolveUserID is a helper for tests / future auth middleware.
func ResolveUserID(c *gin.Context) string {
	if u := c.GetHeader("X-User-Id"); u != "" {
		return strings.TrimSpace(u)
	}
	return strings.TrimSpace(c.Query("userId"))
}
