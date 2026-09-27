package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRESTNotificationRoutesAreRegisteredBeforeIDCapture(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api/v1/notifications")
	api.GET("/nav-badges", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	api.POST("/read-receipts", func(c *gin.Context) { c.Status(http.StatusAccepted) })
	api.PATCH("/:id", func(c *gin.Context) {
		if c.Param("id") != "note-1" {
			t.Fatalf("id = %q", c.Param("id"))
		}
		c.Status(http.StatusOK)
	})

	receipts := httptest.NewRecorder()
	router.ServeHTTP(receipts, httptest.NewRequest(http.MethodPost, "/api/v1/notifications/read-receipts", nil))
	if receipts.Code != http.StatusAccepted {
		t.Fatalf("POST /read-receipts = %d", receipts.Code)
	}

	patch := httptest.NewRecorder()
	router.ServeHTTP(patch, httptest.NewRequest(http.MethodPatch, "/api/v1/notifications/note-1", nil))
	if patch.Code != http.StatusOK {
		t.Fatalf("PATCH /:id = %d", patch.Code)
	}
}
