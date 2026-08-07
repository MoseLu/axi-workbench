package store

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/axi-workbench/platform-core/internal/model"
	"github.com/google/uuid"
)

type MemoryStore struct {
	mu           sync.Mutex
	now          func() time.Time
	tenants      map[string]model.Tenant
	members      map[string]map[string]model.Membership
	preferences  map[string]model.Preferences
	dictionaries map[string]model.Dictionary
	projects     map[string]model.Project
	tasks        map[string]model.Task
	outbox       map[string]model.OutboxEvent
}

func NewMemory(now func() time.Time) *MemoryStore {
	if now == nil {
		now = time.Now
	}
	return &MemoryStore{
		now:          now,
		tenants:      make(map[string]model.Tenant),
		members:      make(map[string]map[string]model.Membership),
		preferences:  make(map[string]model.Preferences),
		dictionaries: make(map[string]model.Dictionary),
		projects:     make(map[string]model.Project),
		tasks:        make(map[string]model.Task),
		outbox:       make(map[string]model.OutboxEvent),
	}
}

func (s *MemoryStore) CreateTenant(_ context.Context, subject, name, slug string) (model.Tenant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, tenant := range s.tenants {
		if tenant.Slug == slug {
			return model.Tenant{}, ErrConflict
		}
	}
	now := s.now().UTC()
	tenant := model.Tenant{ID: uuid.NewString(), Name: name, Slug: slug, CreatedAt: now}
	s.tenants[tenant.ID] = tenant
	s.members[tenant.ID] = map[string]model.Membership{
		subject: {TenantID: tenant.ID, Subject: subject, Role: model.RoleOwner, CreatedAt: now, UpdatedAt: now},
	}
	s.appendOutbox(tenant.ID, "tenant.created", map[string]string{"tenantId": tenant.ID, "subject": subject})
	return tenant, nil
}

func (s *MemoryStore) ListTenants(_ context.Context, subject string) ([]model.Tenant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]model.Tenant, 0)
	for tenantID, memberships := range s.members {
		if _, ok := memberships[subject]; ok {
			result = append(result, s.tenants[tenantID])
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.Before(result[j].CreatedAt) })
	return result, nil
}

func (s *MemoryStore) ListMembers(_ context.Context, subject, tenantID string) ([]model.Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canRead(subject, tenantID) {
		return nil, ErrForbidden
	}
	result := make([]model.Membership, 0, len(s.members[tenantID]))
	for _, member := range s.members[tenantID] {
		result = append(result, member)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Subject < result[j].Subject })
	return result, nil
}

func (s *MemoryStore) UpsertMember(_ context.Context, actor, tenantID, memberSubject string, role model.Role) (model.Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManage(actor, tenantID) {
		return model.Membership{}, ErrForbidden
	}
	if !role.Valid() {
		return model.Membership{}, ErrConflict
	}
	now := s.now().UTC()
	existing, exists := s.members[tenantID][memberSubject]
	if existing.Role == model.RoleOwner && role != model.RoleOwner && memberSubject != actor {
		return model.Membership{}, ErrForbidden
	}
	if !exists {
		existing = model.Membership{TenantID: tenantID, Subject: memberSubject, CreatedAt: now}
	}
	existing.Role = role
	existing.UpdatedAt = now
	s.members[tenantID][memberSubject] = existing
	s.appendOutbox(tenantID, "tenant.member.changed", map[string]string{
		"tenantId": tenantID, "subject": memberSubject, "role": string(role), "changedBy": actor,
	})
	return existing, nil
}

func (s *MemoryStore) GetPreferences(_ context.Context, subject string) (model.Preferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if preferences, ok := s.preferences[subject]; ok {
		return preferences, nil
	}
	return model.Preferences{Subject: subject, Locale: "zh-CN", Theme: "system", Timezone: "Asia/Shanghai", UpdatedAt: s.now().UTC()}, nil
}

func (s *MemoryStore) SavePreferences(_ context.Context, preferences model.Preferences) (model.Preferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	preferences.UpdatedAt = s.now().UTC()
	s.preferences[preferences.Subject] = preferences
	return preferences, nil
}

func (s *MemoryStore) GetDictionary(_ context.Context, subject, tenantID, key string) (model.Dictionary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canRead(subject, tenantID) {
		return model.Dictionary{}, ErrForbidden
	}
	dictionary, ok := s.dictionaries[tenantID+"\x00"+key]
	if !ok {
		return model.Dictionary{}, ErrNotFound
	}
	return cloneDictionary(dictionary), nil
}

func (s *MemoryStore) PutDictionary(_ context.Context, actor string, dictionary model.Dictionary) (model.Dictionary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManage(actor, dictionary.TenantID) {
		return model.Dictionary{}, ErrForbidden
	}
	key := dictionary.TenantID + "\x00" + dictionary.Key
	if existing, ok := s.dictionaries[key]; ok {
		dictionary.Version = existing.Version + 1
	} else {
		dictionary.Version = 1
	}
	dictionary.UpdatedAt = s.now().UTC()
	dictionary = cloneDictionary(dictionary)
	s.dictionaries[key] = dictionary
	s.appendOutbox(dictionary.TenantID, "dictionary.changed", map[string]any{
		"tenantId": dictionary.TenantID, "key": dictionary.Key, "version": dictionary.Version, "changedBy": actor,
	})
	return cloneDictionary(dictionary), nil
}

func (s *MemoryStore) ListProjects(_ context.Context, subject, tenantID string) ([]model.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canRead(subject, tenantID) {
		return nil, ErrForbidden
	}
	result := make([]model.Project, 0)
	for _, project := range s.projects {
		if project.TenantID == tenantID {
			result = append(result, project)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.Before(result[j].CreatedAt) })
	return result, nil
}

func (s *MemoryStore) CreateProject(_ context.Context, actor string, project model.Project) (model.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canWrite(actor, project.TenantID) {
		return model.Project{}, ErrForbidden
	}
	now := s.now().UTC()
	project.ID = uuid.NewString()
	project.CreatedBy = actor
	project.CreatedAt = now
	project.UpdatedAt = now
	s.projects[project.ID] = project
	s.appendOutbox(project.TenantID, "project.created", map[string]string{
		"tenantId": project.TenantID, "projectId": project.ID, "name": project.Name, "createdBy": project.CreatedBy,
	})
	return project, nil
}

func (s *MemoryStore) ListTasks(_ context.Context, subject, tenantID string) ([]model.Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canRead(subject, tenantID) {
		return nil, ErrForbidden
	}
	result := make([]model.Task, 0)
	for _, task := range s.tasks {
		if task.TenantID == tenantID {
			result = append(result, task)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CreatedAt.Before(result[j].CreatedAt) })
	return result, nil
}

func (s *MemoryStore) CreateTask(_ context.Context, actor string, task model.Task) (model.Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canWrite(actor, task.TenantID) {
		return model.Task{}, ErrForbidden
	}
	if task.ProjectID != "" {
		project, ok := s.projects[task.ProjectID]
		if !ok || project.TenantID != task.TenantID {
			return model.Task{}, ErrConflict
		}
	}
	now := s.now().UTC()
	task.ID = uuid.NewString()
	task.CreatedBy = actor
	task.CreatedAt = now
	task.UpdatedAt = now
	if task.Status == "" {
		task.Status = "todo"
	}
	s.tasks[task.ID] = task
	s.appendOutbox(task.TenantID, "task.created", map[string]string{
		"tenantId": task.TenantID, "taskId": task.ID, "projectId": task.ProjectID,
		"title": task.Title, "createdBy": task.CreatedBy,
	})
	return task, nil
}

// AppendAudit is intentionally a no-op in the local in-memory implementation.
// Production uses PostgreSQL, where audit rows are append-only records.
func (s *MemoryStore) AppendAudit(context.Context, model.AuditEvent) error { return nil }

func (s *MemoryStore) ClaimOutbox(_ context.Context, limit int) ([]model.OutboxEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]model.OutboxEvent, 0, limit)
	for id, event := range s.outbox {
		if len(result) >= limit {
			break
		}
		event.Attempts++
		s.outbox[id] = event
		result = append(result, event)
	}
	return result, nil
}

func (s *MemoryStore) MarkOutboxDelivered(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.outbox, id)
	return nil
}

func (s *MemoryStore) ReleaseOutbox(_ context.Context, _ string, _ string) error { return nil }
func (s *MemoryStore) Ping(context.Context) error                                { return nil }
func (s *MemoryStore) Close()                                                    {}

func (s *MemoryStore) canRead(subject, tenantID string) bool {
	_, exists := s.members[tenantID][subject]
	return exists
}

func (s *MemoryStore) canWrite(subject, tenantID string) bool {
	member, exists := s.members[tenantID][subject]
	return exists && (member.Role == model.RoleOwner || member.Role == model.RoleAdmin || member.Role == model.RoleEditor)
}

func (s *MemoryStore) canManage(subject, tenantID string) bool {
	member, exists := s.members[tenantID][subject]
	return exists && (member.Role == model.RoleOwner || member.Role == model.RoleAdmin)
}

func (s *MemoryStore) appendOutbox(tenantID, topic string, payload any) {
	encoded, _ := json.Marshal(payload)
	event := model.OutboxEvent{ID: uuid.NewString(), TenantID: tenantID, Topic: topic, Payload: encoded, CreatedAt: s.now().UTC()}
	s.outbox[event.ID] = event
}

func cloneDictionary(dictionary model.Dictionary) model.Dictionary {
	dictionary.Entries = append(json.RawMessage(nil), dictionary.Entries...)
	return dictionary
}
