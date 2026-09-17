package httpapi

import (
	"crypto/subtle"
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/axi-workbench/platform-core/internal/config"
	"github.com/axi-workbench/platform-core/internal/model"
	"github.com/axi-workbench/platform-core/internal/observability"
	"github.com/axi-workbench/platform-core/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	tenantSlugPattern    = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}$`)
	dictionaryKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9._-]{0,127}$`)
)

const (
	internalTokenHeader = "X-Axi-Internal-Token"
	subjectHeader       = "X-Axi-Subject"
)

type API struct {
	config config.Config
	store  store.Store
	logger *slog.Logger
}

func New(cfg config.Config, persistence store.Store, logger *slog.Logger) *API {
	if logger == nil {
		logger = slog.Default()
	}
	return &API{config: cfg, store: persistence, logger: logger}
}

func (a *API) Router() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery(), a.requestID(), observability.Gin("axi-platform-core"))
	router.GET("/health", a.health)
	router.GET("/ready", a.ready)

	api := router.Group("/api/v1")
	api.Use(a.requireInternal())
	api.GET("/tenants", a.listTenants)
	api.POST("/tenants", a.createTenant)
	api.GET("/tenants/:tenantID/members", a.listMembers)
	api.PUT("/tenants/:tenantID/members/:memberSubject", a.upsertMember)
	api.GET("/me/preferences", a.getPreferences)
	api.PATCH("/me/preferences", a.patchPreferences)
	api.GET("/tenants/:tenantID/dictionaries/:key", a.getDictionary)
	api.PUT("/tenants/:tenantID/dictionaries/:key", a.putDictionary)
	api.GET("/tenants/:tenantID/projects", a.listProjects)
	api.POST("/tenants/:tenantID/projects", a.createProject)
	api.GET("/tenants/:tenantID/tasks", a.listTasks)
	api.POST("/tenants/:tenantID/tasks", a.createTask)
	return router
}

func (a *API) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *API) ready(c *gin.Context) {
	if err := a.store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "platform persistence is unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

func (a *API) requestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Header("X-Request-ID", requestID)
		c.Set("requestID", requestID)
		c.Next()
	}
}

func (a *API) requireInternal() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !constantTimeEqual(c.GetHeader(internalTokenHeader), a.config.InternalServiceToken) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "trusted gateway request required"})
			return
		}
		if strings.TrimSpace(c.GetHeader(subjectHeader)) == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "verified subject required"})
			return
		}
		c.Next()
	}
}

type createTenantRequest struct {
	Name string `json:"name" binding:"required"`
	Slug string `json:"slug" binding:"required"`
}

func (a *API) createTenant(c *gin.Context) {
	var request createTenantRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant name and slug are required"})
		return
	}
	name := strings.TrimSpace(request.Name)
	slug := strings.ToLower(strings.TrimSpace(request.Slug))
	if len(name) < 2 || len(name) > 120 || !tenantSlugPattern.MatchString(slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant name or slug is invalid"})
		return
	}
	tenant, err := a.store.CreateTenant(c.Request.Context(), a.subject(c), name, slug)
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "tenant.created", "tenantID", tenant.ID, "subject", a.subject(c))
	c.JSON(http.StatusCreated, tenant)
}

func (a *API) listTenants(c *gin.Context) {
	tenants, err := a.store.ListTenants(c.Request.Context(), a.subject(c))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": tenants})
}

func (a *API) listMembers(c *gin.Context) {
	members, err := a.store.ListMembers(c.Request.Context(), a.subject(c), c.Param("tenantID"))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": members})
}

type upsertMemberRequest struct {
	Role model.Role `json:"role" binding:"required"`
}

func (a *API) upsertMember(c *gin.Context) {
	var request upsertMemberRequest
	if err := c.ShouldBindJSON(&request); err != nil || !request.Role.Valid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a valid tenant role is required"})
		return
	}
	memberSubject := strings.TrimSpace(c.Param("memberSubject"))
	if memberSubject == "" || len(memberSubject) > 255 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "member subject is invalid"})
		return
	}
	membership, err := a.store.UpsertMember(c.Request.Context(), a.subject(c), c.Param("tenantID"), memberSubject, request.Role)
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "tenant.member.changed", "tenantID", membership.TenantID, "memberSubject", membership.Subject, "role", membership.Role)
	c.JSON(http.StatusOK, membership)
}

func (a *API) getPreferences(c *gin.Context) {
	preferences, err := a.store.GetPreferences(c.Request.Context(), a.subject(c))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, preferences)
}

type patchPreferencesRequest struct {
	Locale             *string `json:"locale"`
	Theme              *string `json:"theme"`
	Timezone           *string `json:"timezone"`
	NotificationsMuted *bool   `json:"notificationsMuted"`
}

func (a *API) patchPreferences(c *gin.Context) {
	var request patchPreferencesRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid preferences payload"})
		return
	}
	preferences, err := a.store.GetPreferences(c.Request.Context(), a.subject(c))
	if err != nil {
		a.domainError(c, err)
		return
	}
	if request.Locale != nil {
		preferences.Locale = strings.TrimSpace(*request.Locale)
	}
	if request.Theme != nil {
		preferences.Theme = strings.TrimSpace(*request.Theme)
	}
	if request.Timezone != nil {
		preferences.Timezone = strings.TrimSpace(*request.Timezone)
	}
	if request.NotificationsMuted != nil {
		preferences.NotificationsMuted = *request.NotificationsMuted
	}
	if !validPreferences(preferences) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "locale, theme, or timezone is invalid"})
		return
	}
	preferences, err = a.store.SavePreferences(c.Request.Context(), preferences)
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "preferences.updated", "subject", a.subject(c))
	c.JSON(http.StatusOK, preferences)
}

func (a *API) getDictionary(c *gin.Context) {
	if !dictionaryKeyPattern.MatchString(c.Param("key")) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dictionary key is invalid"})
		return
	}
	dictionary, err := a.store.GetDictionary(c.Request.Context(), a.subject(c), c.Param("tenantID"), c.Param("key"))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, dictionary)
}

type putDictionaryRequest struct {
	Entries json.RawMessage `json:"entries" binding:"required"`
}

func (a *API) putDictionary(c *gin.Context) {
	var request putDictionaryRequest
	if err := c.ShouldBindJSON(&request); err != nil || !dictionaryKeyPattern.MatchString(c.Param("key")) || !validJSONObject(request.Entries) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dictionary key and JSON object entries are required"})
		return
	}
	dictionary, err := a.store.PutDictionary(c.Request.Context(), a.subject(c), model.Dictionary{
		TenantID: c.Param("tenantID"),
		Key:      c.Param("key"),
		Entries:  request.Entries,
	})
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "dictionary.updated", "tenantID", dictionary.TenantID, "key", dictionary.Key, "version", dictionary.Version)
	c.JSON(http.StatusOK, dictionary)
}

type createProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

func (a *API) createProject(c *gin.Context) {
	var request createProjectRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project name is required"})
		return
	}
	if len(strings.TrimSpace(request.Name)) < 1 || len(request.Name) > 160 || len(request.Description) > 4000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project name or description is invalid"})
		return
	}
	project, err := a.store.CreateProject(c.Request.Context(), a.subject(c), model.Project{
		TenantID:    c.Param("tenantID"),
		Name:        strings.TrimSpace(request.Name),
		Description: strings.TrimSpace(request.Description),
	})
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "project.created", "tenantID", project.TenantID, "projectID", project.ID)
	c.JSON(http.StatusCreated, project)
}

func (a *API) listProjects(c *gin.Context) {
	projects, err := a.store.ListProjects(c.Request.Context(), a.subject(c), c.Param("tenantID"))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": projects})
}

type createTaskRequest struct {
	ProjectID string `json:"projectId"`
	Title     string `json:"title" binding:"required"`
	Status    string `json:"status"`
}

func (a *API) createTask(c *gin.Context) {
	var request createTaskRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task title is required"})
		return
	}
	if len(strings.TrimSpace(request.Title)) < 1 || len(request.Title) > 240 || len(request.Status) > 40 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task title or status is invalid"})
		return
	}
	task, err := a.store.CreateTask(c.Request.Context(), a.subject(c), model.Task{
		TenantID:  c.Param("tenantID"),
		ProjectID: strings.TrimSpace(request.ProjectID),
		Title:     strings.TrimSpace(request.Title),
		Status:    strings.TrimSpace(request.Status),
	})
	if err != nil {
		a.domainError(c, err)
		return
	}
	a.audit(c, "task.created", "tenantID", task.TenantID, "taskID", task.ID)
	c.JSON(http.StatusCreated, task)
}

func (a *API) listTasks(c *gin.Context) {
	tasks, err := a.store.ListTasks(c.Request.Context(), a.subject(c), c.Param("tenantID"))
	if err != nil {
		a.domainError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": tasks})
}

func (a *API) subject(c *gin.Context) string {
	return strings.TrimSpace(c.GetHeader(subjectHeader))
}

func (a *API) domainError(c *gin.Context, err error) {
	switch err {
	case store.ErrNotFound:
		c.JSON(http.StatusNotFound, gin.H{"error": "platform record not found"})
	case store.ErrForbidden:
		c.JSON(http.StatusForbidden, gin.H{"error": "platform action is forbidden"})
	case store.ErrConflict:
		c.JSON(http.StatusConflict, gin.H{"error": "platform record conflicts with current state"})
	default:
		a.logger.Error("platform core request failed", "requestID", c.GetString("requestID"), "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "platform service temporarily unavailable"})
	}
}

func (a *API) audit(c *gin.Context, event string, attributes ...any) {
	values := []any{"event", event, "requestID", c.GetString("requestID")}
	values = append(values, attributes...)
	a.logger.Info("platform audit", values...)

	payload := make(map[string]any, len(attributes)/2)
	tenantID := ""
	for index := 0; index+1 < len(attributes); index += 2 {
		key, ok := attributes[index].(string)
		if !ok {
			continue
		}
		payload[key] = attributes[index+1]
		if key == "tenantID" {
			if value, ok := attributes[index+1].(string); ok {
				tenantID = value
			}
		}
	}
	if err := a.store.AppendAudit(c.Request.Context(), model.AuditEvent{
		TenantID:  tenantID,
		Subject:   a.subject(c),
		Action:    event,
		RequestID: c.GetString("requestID"),
		Payload:   payload,
	}); err != nil {
		// Business writes have already succeeded. Preserve user-visible success
		// while making a failed immutable-audit write highly visible to operators.
		a.logger.Error("persist platform audit", "event", event, "requestID", c.GetString("requestID"), "error", err)
	}
}

func validPreferences(preferences model.Preferences) bool {
	if len(preferences.Locale) < 2 || len(preferences.Locale) > 35 || len(preferences.Timezone) == 0 || len(preferences.Timezone) > 64 {
		return false
	}
	if preferences.Theme != "light" && preferences.Theme != "dark" && preferences.Theme != "system" {
		return false
	}
	_, err := time.LoadLocation(preferences.Timezone)
	return err == nil
}

func validJSONObject(value json.RawMessage) bool {
	var object map[string]any
	return len(value) > 0 && json.Unmarshal(value, &object) == nil && object != nil
}

func constantTimeEqual(left, right string) bool {
	if left == "" || right == "" || len(left) != len(right) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}
