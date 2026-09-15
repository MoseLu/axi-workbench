package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/epap/api-gateway/identity"
	"github.com/epap/api-gateway/middleware"
	"github.com/gin-gonic/gin"
)

func TestProfileRoutesPersistAndReturnUsername(t *testing.T) {
	service := identity.NewForTest(handlerIdentityConfig(), identity.NewMemoryRecordStore(nil), nil, nil)
	router := gin.New()
	protected := router.Group("/api/v1/users/me")
	protected.Use(middleware.RequireIdentity(service))
	protected.GET("/profile", GetProfile(service))
	protected.PATCH("/profile", UpdateProfile(service))

	get := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/profile", nil)
	request.Header.Set("X-Axi-Development-Subject", "owner-subject")
	request.Header.Set("X-Axi-Development-Email", "alexandria.long.lastname@outlook.com")
	router.ServeHTTP(get, request)
	if get.Code != http.StatusOK {
		t.Fatalf("get profile status = %d; body=%s", get.Code, get.Body.String())
	}
	var initial struct {
		User identity.Principal `json:"user"`
	}
	if err := json.Unmarshal(get.Body.Bytes(), &initial); err != nil {
		t.Fatalf("decode initial profile: %v", err)
	}
	if initial.User.Name == "" || len([]rune(initial.User.Name)) > identity.GeneratedUsernameLength {
		t.Fatalf("initial username = %q", initial.User.Name)
	}

	update := httptest.NewRecorder()
	updateRequest := httptest.NewRequest(http.MethodPatch, "/api/v1/users/me/profile", bytes.NewBufferString(`{"username":"公理工作台"}`))
	updateRequest.Header.Set("Content-Type", "application/json")
	updateRequest.Header.Set("X-Axi-Development-Subject", "owner-subject")
	updateRequest.Header.Set("X-Axi-Development-Email", "alexandria.long.lastname@outlook.com")
	router.ServeHTTP(update, updateRequest)
	if update.Code != http.StatusOK {
		t.Fatalf("update profile status = %d; body=%s", update.Code, update.Body.String())
	}

	reloaded := httptest.NewRecorder()
	reloadRequest := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/profile", nil).WithContext(context.Background())
	reloadRequest.Header.Set("X-Axi-Development-Subject", "owner-subject")
	reloadRequest.Header.Set("X-Axi-Development-Email", "alexandria.long.lastname@outlook.com")
	router.ServeHTTP(reloaded, reloadRequest)
	var saved struct {
		User identity.Principal `json:"user"`
	}
	if err := json.Unmarshal(reloaded.Body.Bytes(), &saved); err != nil {
		t.Fatalf("decode saved profile: %v", err)
	}
	if saved.User.Name != "公理工作台" {
		t.Fatalf("saved username = %q", saved.User.Name)
	}
}
