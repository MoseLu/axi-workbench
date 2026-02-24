package handlers

import (
	"net/http"

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
	notifications := h.service.ListNotifications()
	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}
